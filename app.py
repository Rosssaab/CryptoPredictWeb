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

app = Flask(__name__)
app.config['APPLICATION_ROOT'] = '/CryptoPrediction'
app.config['PREFERRED_URL_SCHEME'] = 'https'

def get_top_cryptos():
    url = "https://api.coingecko.com/api/v3/coins/markets"
    params = {
        "vs_currency": "usd",
        "order": "market_cap_desc",
        "per_page": 30,
        "page": 1,
        "sparkline": False
    }

    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'USDD']
        
        cryptos = []
        for coin in data:
            symbol = coin['symbol'].upper()
            if symbol not in stablecoins:
                cryptos.append(symbol)
                if len(cryptos) == 20:
                    break

        return cryptos

    except Exception as e:
        print(f"Error fetching top cryptos: {e}")
        return ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'ADA', 'DOGE', 'TRX', 'LINK', 'DOT', 
                'MATIC', 'TON', 'AVAX', 'UNI', 'ICP', 'ATOM', 'XLM', 'LTC', 'BCH', 'XMR']

def fetch_crypto_data(symbol, period='3mo'):
    try:
        ticker = yf.Ticker(f"{symbol}-USD")
        data = ticker.history(period=period)
        if data.empty:
            raise ValueError(f"No data found for {symbol}")
        return data
    except Exception as e:
        raise ValueError(f"Error fetching data for {symbol}: {str(e)}")

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
    cryptos = get_top_cryptos()
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

if __name__ == '__main__':
    print("Starting Crypto Prediction server on port 8087...")
    serve(app, host='127.0.0.1', port=8087)