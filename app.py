from flask import Flask, render_template, jsonify, request
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.svm import SVR
import plotly.graph_objects as go
import datetime
import requests
from waitress import serve
from binance.client import Client
from config import BINANCE_API_KEY, BINANCE_SECRET_KEY

app = Flask(__name__)
app.config['APPLICATION_ROOT'] = '/CryptoPrediction'
app.config['PREFERRED_URL_SCHEME'] = 'https'

def get_binance_client():
    """Initialize Binance client"""
    try:
        client = Client(BINANCE_API_KEY, BINANCE_SECRET_KEY)
        return client
    except Exception as e:
        raise Exception(f"Failed to initialize Binance client: {str(e)}")

def fetch_crypto_data(symbol, period='2y', interval='2h'):
    """
    Fetch cryptocurrency data from Binance
    symbol: str - Cryptocurrency symbol (e.g., 'BTC', 'ETH')
    period: str - Time period ('3mo', '6mo', '1y', '2y', '5y')
    interval: str - Data interval ('2h', '4h', '1d')
    """
    try:
        client = get_binance_client()
        
        # Convert period to milliseconds
        period_map = {
            '3mo': '90 days ago UTC',
            '6mo': '180 days ago UTC',
            '1y': '365 days ago UTC',
            '2y': '730 days ago UTC',
            '5y': '1825 days ago UTC'
        }
        start_str = period_map.get(period, '730 days ago UTC')
        
        # Convert interval to Binance format
        interval_map = {
            '2h': Client.KLINE_INTERVAL_2HOUR,
            '4h': Client.KLINE_INTERVAL_4HOUR,
            '1d': Client.KLINE_INTERVAL_1DAY
        }
        binance_interval = interval_map.get(interval, Client.KLINE_INTERVAL_2HOUR)
        
        print(f"Fetching {symbol} data with {interval} interval")
        
        # Fetch data from Binance
        klines = client.get_historical_klines(
            f"{symbol}USDT",
            binance_interval,
            start_str=start_str
        )
        
        if not klines:
            raise ValueError(f"No data available for {symbol}")
        
        # Convert to DataFrame with correct column names
        df = pd.DataFrame(klines, columns=[
            'timestamp', 'Open', 'High', 'Low', 'Close', 'Volume',
            'close_time', 'quote_volume', 'trades', 'taker_buy_base',
            'taker_buy_quote', 'ignored'
        ])
        
        # Convert timestamps to datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df.set_index('timestamp', inplace=True)
        
        # Convert string values to float
        numeric_columns = ['Open', 'High', 'Low', 'Close', 'Volume']
        for col in numeric_columns:
            df[col] = df[col].astype(float)
        
        # Add technical indicators
        df['Hour'] = df.index.hour
        df['DayOfWeek'] = df.index.dayofweek
        
        return df
        
    except Exception as e:
        print(f"Debug - Error details: {str(e)}")  # Add debug print
        raise Exception(f"Error fetching data from Binance: {str(e)}")

def get_available_cryptos():
    """Get list of available cryptocurrencies"""
    try:
        client = get_binance_client()
        info = client.get_exchange_info()
        # Filter for USDT pairs and remove the USDT suffix
        symbols = [s['symbol'][:-4] for s in info['symbols'] 
                  if s['symbol'].endswith('USDT') and s['status'] == 'TRADING']
        return sorted(symbols)
    except Exception as e:
        return ['BTC', 'ETH', 'BNB', 'XRP', 'ADA']  # Fallback to major cryptos

def prepare_data(data):
    if len(data) < 2:
        return np.array([]), np.array([]), None, None
    
    # Calculate technical indicators
    data['SMA_20'] = data['Close'].rolling(window=20).mean()
    data['SMA_50'] = data['Close'].rolling(window=50).mean()
    data['RSI'] = calculate_rsi(data['Close'])
    data['Volatility'] = data['Close'].rolling(window=20).std()
    
    # Calculate price changes
    data['Price_Change'] = data['Close'].pct_change()
    data['Volatility_Change'] = data['Volatility'].pct_change()
    
    # Create features matrix
    features = np.column_stack([
        np.arange(len(data)),  # Time component
        data['SMA_20'].fillna(method='bfill'),
        data['SMA_50'].fillna(method='bfill'),
        data['RSI'].fillna(method='bfill'),
        data['Volatility'].fillna(method='bfill'),
        data['Volume'].fillna(method='bfill'),
    ])
    
    # Create separate scalers for features and prices
    feature_scaler = MinMaxScaler()
    price_scaler = MinMaxScaler()
    
    # Scale features and prices separately
    scaled_features = feature_scaler.fit_transform(features)
    scaled_prices = price_scaler.fit_transform(data['Close'].values.reshape(-1, 1))
    
    return scaled_features, scaled_prices.ravel(), feature_scaler, price_scaler

def calculate_rsi(prices, period=14):
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def create_and_train_model(X, y):
    # More conservative SVR parameters
    model = SVR(
        kernel='rbf',
        C=1.0,        # Reduced from 100 to prevent overfitting
        gamma='scale',  # Using 'scale' instead of fixed value
        epsilon=0.1,
        tol=1e-3,
        cache_size=200
    )
    model.fit(X, y.ravel())
    return model

@app.route('/')
def index():
    cryptos = get_available_cryptos()
    return render_template('index.html', cryptos=cryptos)

@app.route('/predict/<symbol>')
def predict(symbol):
    try:
        # Get parameters first
        period = request.args.get('period', '3mo')
        predict_days = int(request.args.get('predict_days', '7'))
        
        # Validate parameters
        if not symbol or not period or not predict_days:
            raise ValueError("Missing required parameters")
            
        # Fetch and prepare data
        data = fetch_crypto_data(symbol, period=period)
        if data.empty:
            raise ValueError(f"No data available for {symbol}")
            
        X, y, feature_scaler, price_scaler = prepare_data(data)
        
        if len(X) == 0 or len(y) == 0:
            raise ValueError("Insufficient data for prediction")
        
        # Create and train model
        model = create_and_train_model(X, y)
        
        # Calculate volatility constraints
        recent_volatility = data['Close'].pct_change().std()
        max_daily_change = min(recent_volatility * 2, 0.1)  # Cap at 10% daily change
        
        # Generate future predictions
        last_day = len(X)
        future_features = []
        
        for i in range(predict_days):
            next_day = last_day + i
            sma_20 = data['Close'][-20:].mean()
            sma_50 = data['Close'][-50:].mean()
            rsi = calculate_rsi(data['Close'])[-1]
            volatility = data['Close'][-20:].std()
            volume = data['Volume'][-1]
            
            future_feature = np.array([
                next_day,
                sma_20,
                sma_50,
                rsi,
                volatility,
                volume
            ]).reshape(1, -1)
            
            future_features.append(future_feature)
        
        future_features = np.vstack(future_features)
        scaled_future_features = feature_scaler.transform(future_features)
        
        # Generate predictions with constraints
        predictions = []
        last_price = data['Close'].iloc[-1]
        
        for i in range(predict_days):
            pred = model.predict(scaled_future_features[i].reshape(1, -1))
            pred = price_scaler.inverse_transform(pred.reshape(-1, 1))[0][0]
            
            # Apply volatility constraints
            max_change = last_price * max_daily_change
            pred = np.clip(pred, 
                         last_price - max_change,
                         last_price + max_change)
            
            predictions.append(pred)
            last_price = pred
        
        # Generate dates for predictions
        dates = pd.date_range(
            start=data.index[-1], 
            periods=predict_days + 1,
            freq='D'
        )[1:]
        
        # Prepare response
        chart_data = {
            'historical': {
                'dates': data.index.strftime('%Y-%m-%d').tolist(),
                'prices': data['Close'].tolist()
            },
            'predictions': {
                'dates': dates.strftime('%Y-%m-%d').tolist(),
                'prices': predictions
            },
            'summary': {
                'current_price': float(data['Close'].iloc[-1]),
                'final_prediction': float(predictions[-1]),
                'final_date': dates[-1].strftime('%Y-%m-%d')
            }
        }
        
        return jsonify(chart_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/suggest')
def suggest_coins():
    try:
        predict_days = int(request.args.get('predict_days', '7'))
        client = get_binance_client()
        
        # Get top trading pairs by volume
        tickers = client.get_ticker()
        usdt_pairs = [t for t in tickers if t['symbol'].endswith('USDT')]
        
        # Filter and sort by volume
        positive_pairs = [t for t in usdt_pairs if float(t['priceChangePercent']) > 0]
        positive_pairs.sort(key=lambda x: float(x['volume']), reverse=True)
        top_pairs = positive_pairs[:10]  # Get top 10 by volume
        
        suggestions = []
        for ticker in top_pairs:
            try:
                symbol = ticker['symbol'][:-4]
                print(f"Analyzing {symbol}...")
                
                # Use the same data fetching and prediction logic as the main predict route
                data = fetch_crypto_data(symbol, period='3mo')  # Use shorter period for quick analysis
                if data.empty:
                    continue
                    
                X, y, feature_scaler, price_scaler = prepare_data(data)
                if len(X) == 0 or len(y) == 0:
                    continue
                
                # Create and train model
                model = create_and_train_model(X, y)
                
                # Calculate prediction for the specified period
                current_price = float(data['Close'].iloc[-1])
                
                # Generate future features and prediction
                last_day = len(X)
                future_feature = np.array([
                    last_day + predict_days,
                    data['SMA_20'].iloc[-1],
                    data['SMA_50'].iloc[-1],
                    data['RSI'].iloc[-1],
                    data['Volatility'].iloc[-1],
                    data['Volume'].iloc[-1]
                ]).reshape(1, -1)
                
                scaled_future_feature = feature_scaler.transform(future_feature)
                predicted_price = float(price_scaler.inverse_transform(
                    model.predict(scaled_future_feature).reshape(-1, 1)
                )[0][0])
                
                # Calculate predicted growth as percentage
                predicted_growth = ((predicted_price - current_price) / current_price) * 100
                
                if predicted_growth > 0:  # Only include positive predictions
                    suggestions.append({
                        "symbol": symbol,
                        "current_price": current_price,
                        "predicted_price": predicted_price,
                        "predicted_growth": predicted_growth
                    })
                
            except Exception as e:
                print(f"Error analyzing {symbol}: {str(e)}")
                continue
        
        # Sort by predicted growth and get top 3
        suggestions.sort(key=lambda x: x['predicted_growth'], reverse=True)
        suggestions = suggestions[:3]
        
        return jsonify({"suggestions": suggestions})
        
    except Exception as e:
        print(f"Suggestion error: {str(e)}")
        return jsonify({"error": str(e)}), 400
    
if __name__ == '__main__':
    print("Starting Crypto Prediction server on port 8087...")
    serve(app, host='127.0.0.1', port=8087)