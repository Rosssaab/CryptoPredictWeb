from flask import Flask, render_template, jsonify, request
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.svm import SVR
import plotly.graph_objects as go
import datetime

app = Flask(__name__)

TOP_CRYPTOS = [
    'BTC', 'ETH', 'USDT', 'BNB', 'SOL',
    'XRP', 'USDC', 'ADA', 'AVAX', 'DOGE'
]

def fetch_crypto_data(symbol, period='6mo'):
    """Fetch historical cryptocurrency data"""
    try:
        crypto = yf.Ticker(f"{symbol}-USD")
        data = crypto.history(period=period)
        print(f"Fetched data shape: {data.shape}")
        print(f"First few rows:\n{data.head()}")
        
        if data.empty:
            raise ValueError(f"No data received for {symbol}")
            
        if len(data) < 30:  # We need at least 30 days of data
            raise ValueError(f"Insufficient data for {symbol}. Got {len(data)} days, need at least 30.")
            
        return data
        
    except Exception as e:
        raise ValueError(f"Error fetching data for {symbol}: {str(e)}")

def prepare_data(data):
    """Prepare data for SVR model"""
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(data['Close'].values.reshape(-1, 1))
    
    # Create features (using last 30 days for prediction)
    X = np.arange(len(scaled_data)).reshape(-1, 1)
    y = scaled_data
    
    return X, y, scaler

def create_and_train_model(X, y):
    """Create and train SVR model"""
    model = SVR(kernel='rbf', C=100, gamma=0.1, epsilon=.1)
    model.fit(X, y.ravel())
    return model

@app.route('/')
def index():
    return render_template('index.html', cryptos=TOP_CRYPTOS)

@app.route('/predict/<symbol>')
def predict(symbol):
    try:
        period = request.args.get('period', '6mo')
        predict_days = int(request.args.get('predict_days', '7'))
        
        # Fetch data
        data = fetch_crypto_data(symbol, period=period)
        
        # Prepare data
        X, y, scaler = prepare_data(data)
        
        if len(X) == 0 or len(y) == 0:
            raise ValueError("No valid data after preparation")
        
        # Create and train model
        model = create_and_train_model(X, y)
        
        # Make predictions
        last_day = len(X)
        future_days = np.arange(last_day, last_day + predict_days).reshape(-1, 1)
        future_pred_scaled = model.predict(future_days)
        predictions = scaler.inverse_transform(future_pred_scaled.reshape(-1, 1)).flatten()
        
        # Prepare chart data
        dates = pd.date_range(
            start=data.index[-1], 
            periods=predict_days + 1,
            freq='D'
        )[1:]
        
        chart_data = {
            'historical': {
                'dates': data.index.strftime('%Y-%m-%d').tolist(),
                'prices': data['Close'].tolist()
            },
            'predictions': {
                'dates': dates.strftime('%Y-%m-%d').tolist(),
                'prices': predictions.tolist()
            }
        }
        
        return jsonify(chart_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)