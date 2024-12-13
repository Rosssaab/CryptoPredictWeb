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
        return np.array([]), np.array([]), None
    
    # Create features (X) as day numbers and target (y) as prices
    scaler = MinMaxScaler()
    scaled_prices = scaler.fit_transform(data['Close'].values.reshape(-1, 1))
    
    X = np.arange(len(data)).reshape(-1, 1)
    y = scaled_prices
    
    return X, y, scaler

def create_and_train_model(X, y):
    model = SVR(kernel='rbf', C=100, gamma=0.1, epsilon=.1)
    model.fit(X, y.ravel())
    return model

@app.route('/')
def index():
    cryptos = get_top_cryptos()
    return render_template('index.html', cryptos=cryptos)

@app.route('/predict/<symbol>')
def predict(symbol):
    try:
        period = request.args.get('period', '3mo')
        predict_days = int(request.args.get('predict_days', '7'))
        
        data = fetch_crypto_data(symbol, period=period)
        X, y, scaler = prepare_data(data)
        
        if len(X) == 0 or len(y) == 0:
            raise ValueError("No valid data after preparation")
        
        model = create_and_train_model(X, y)
        
        last_day = len(X)
        future_days = np.arange(last_day, last_day + predict_days).reshape(-1, 1)
        future_pred_scaled = model.predict(future_days)
        predictions = scaler.inverse_transform(future_pred_scaled.reshape(-1, 1)).flatten()
        
        dates = pd.date_range(
            start=data.index[-1], 
            periods=predict_days + 1,
            freq='D'
        )[1:]
        
        current_price = data['Close'].iloc[-1]
        final_prediction = predictions[-1]
        final_date = dates[-1]
        
        chart_data = {
            'historical': {
                'dates': data.index.strftime('%Y-%m-%d').tolist(),
                'prices': data['Close'].tolist()
            },
            'predictions': {
                'dates': dates.strftime('%Y-%m-%d').tolist(),
                'prices': predictions.tolist()
            },
            'summary': {
                'current_price': round(current_price, 2),
                'final_prediction': round(final_prediction, 2),
                'final_date': final_date.strftime('%Y-%m-%d')
            }
        }
        
        return jsonify(chart_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    print("Starting Crypto Prediction server on port 8087...")
    serve(app, host='127.0.0.1', port=8087)