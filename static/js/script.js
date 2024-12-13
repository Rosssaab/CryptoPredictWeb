function getChartHeight() {
    return window.innerWidth < 768 ? 300 : 600;
}

function getChartWidth() {
    if (window.innerWidth < 768) {
        return window.innerWidth - 70;
    }
    return 1100;
}

async function updateChart() {
    // Get all input values at the start
    const symbol = document.getElementById('cryptoSelect').value;
    const period = document.getElementById('periodSelect').value;
    const predictPeriod = parseInt(document.getElementById('predictPeriodSelect').value);
    
    if (!symbol) return;
    
    document.getElementById('loading').style.display = 'block';
    document.getElementById('chart').innerHTML = '';
    
    // Date formatting function
    const formatDate = (date) => {
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    // Initialize all date variables
    const now = new Date();
    const currentDate = formatDate(now);
    const finalDate = new Date(now);
    finalDate.setDate(now.getDate() + predictPeriod);
    const buyDate = new Date(now);
    buyDate.setDate(now.getDate() + 1);
    const sellDate = new Date(now);
    sellDate.setDate(now.getDate() + 2);

    try {
        const response = await fetch(`/CryptoPrediction/predict/${symbol}?period=${period}&predict_days=${predictPeriod}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const trace1 = {
            x: data.historical.dates,
            y: data.historical.prices,
            name: 'Historical',
            type: 'scatter',
            line: {
                color: '#2C3E50'
            },
            showlegend: false
        };
        
        const trace2 = {
            x: data.predictions.dates,
            y: data.predictions.prices,
            name: 'Predictions',
            type: 'scatter',
            line: {
                color: '#E74C3C',
                dash: 'dot'
            },
            showlegend: false
        };
        
        const layout = {
            title: {
                text: window.innerWidth < 768 ? '' : `${symbol} Price Prediction`,
                font: {
                    size: window.innerWidth < 768 ? 14 : 18
                }
            },
            xaxis: { 
                title: window.innerWidth < 768 ? '' : 'Date',
                showline: true,
                linewidth: 2,
                linecolor: '#000000',
                gridcolor: '#CCCCCC',
                rangeslider: { 
                    visible: true,
                    thickness: 0.1
                }
            },
            yaxis: { 
                title: window.innerWidth < 768 ? '' : 'Price (USD)',
                showline: true,
                linewidth: 2,
                linecolor: '#000000',
                gridcolor: '#CCCCCC',
                fixedrange: false
            },
            height: getChartHeight(),
            width: getChartWidth(),
            autosize: false,
            showlegend: true,
            legend: {
                x: 0.01,
                y: 0.99,
                xanchor: 'left',
                yanchor: 'top',
                bgcolor: 'rgba(255,255,255,0.8)',
                bordercolor: '#CCCCCC',
                borderwidth: 1,
                font: {
                    size: window.innerWidth < 768 ? 10 : 12
                }
            },
            margin: {
                b: window.innerWidth < 768 ? 20 : 60,
                l: window.innerWidth < 768 ? 30 : 60,
                r: window.innerWidth < 768 ? 10 : 60,
                t: window.innerWidth < 768 ? 10 : 50,
                pad: window.innerWidth < 768 ? 0 : 4
            },
            plot_bgcolor: '#F5F5F0',
            paper_bgcolor: '#F5F5F0'
        };
        
        Plotly.newPlot('chart', [trace1, trace2], layout, {
            displayModeBar: false
        });
        
        // Update price displays
        const priceInfo = document.getElementById('priceInfo');
        const stopLossInfo = document.getElementById('stopLossInfo');
        const currentPrice = document.getElementById('currentPrice');
        const predictedPrice = document.getElementById('predictedPrice');

        priceInfo.style.display = 'block';
        stopLossInfo.style.display = 'block';

        const buyTimeStr = `04:00 GMT on ${formatDate(buyDate)}`;
        const sellTimeStr = `14:00 GMT on ${formatDate(sellDate)}`;
        const suggestedBuyPrice = data.summary.current_price * 0.98;
        const suggestedSellPrice = data.summary.current_price * 1.02;

        currentPrice.innerHTML = `$${data.summary.current_price.toLocaleString()} (as of ${currentDate})`;
        predictedPrice.innerHTML = `$${data.summary.final_prediction.toLocaleString()} (predicted for ${formatDate(finalDate)})`;

        stopLossInfo.innerHTML = `
            <h5>Trading Recommendations</h5>
            <p>Best time to buy: <strong>${buyTimeStr}</strong> at target price: <strong>$${suggestedBuyPrice.toLocaleString()}</strong></p>
            <p>Best time to sell: <strong>${sellTimeStr}</strong> at target price: <strong>$${suggestedSellPrice.toLocaleString()}</strong></p>
            <p>Recommended stop-loss: <span id="stopLoss">$${(data.summary.current_price * 0.95).toLocaleString()} (5% below current price)</span></p>
        `;

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('chart').innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
        document.getElementById('priceInfo').style.display = 'none';
        document.getElementById('stopLossInfo').style.display = 'none';
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('predictBtn').addEventListener('click', updateChart);
    
    window.addEventListener('resize', function() {
        const chartDiv = document.getElementById('chart');
        if (chartDiv.data) {
            Plotly.relayout('chart', {
                height: getChartHeight(),
                width: getChartWidth(),
                'legend.font.size': window.innerWidth < 768 ? 10 : 12,
                margin: {
                    b: window.innerWidth < 768 ? 20 : 60,
                    l: window.innerWidth < 768 ? 30 : 60,
                    r: window.innerWidth < 768 ? 10 : 60,
                    t: window.innerWidth < 768 ? 10 : 50,
                    pad: window.innerWidth < 768 ? 0 : 4
                }
            });
        }
    });
});