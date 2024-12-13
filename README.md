# Crypto Price Prediction Web App

A Flask web application that predicts cryptocurrency prices using Support Vector Regression (SVR).

## Features
- Predicts prices for top 10 cryptocurrencies
- Uses 6 months of historical data by default
- Predicts prices for the next 7 days
- Interactive charts using Plotly

## Setup
1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

## Technologies Used
- Flask
- scikit-learn (SVR)
- yfinance
- pandas
- numpy
- plotly 