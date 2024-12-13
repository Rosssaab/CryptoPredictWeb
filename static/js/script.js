function getChartHeight() {
    return window.innerWidth < 768 ? 400 : 600;
}

async function updateChart() {
    const symbol = document.getElementById('cryptoSelect').value;
    const period = document.getElementById('periodSelect').value;
    const predictDays = document.getElementById('predictPeriodSelect').value;
    
    if (!symbol) return;
    
    document.getElementById('loading').style.display = 'block';
    document.getElementById('chart').innerHTML = '';
    
    try {
        const response = await fetch(`/CryptoPrediction/predict/${symbol}?period=${period}&predict_days=${predictDays}`);
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
            }
        };
        
        const trace2 = {
            x: data.predictions.dates,
            y: data.predictions.prices,
            name: 'Predictions',
            type: 'scatter',
            line: {
                color: '#E74C3C',
                dash: 'dot'
            }
        };
        
        const layout = {
            title: `${symbol} Price Prediction`,
            xaxis: { 
                title: 'Date',
                showline: true,
                linewidth: 2,
                linecolor: '#000000',
                gridcolor: '#CCCCCC',
                rangeslider: { visible: true }
            },
            yaxis: { 
                title: 'Price (USD)',
                showline: true,
                linewidth: 2,
                linecolor: '#000000',
                gridcolor: '#CCCCCC',
                fixedrange: false
            },
            height: getChartHeight(),
            width: window.innerWidth < 768 ? window.innerWidth - 40 : 1100,
            autosize: true,
            margin: {
                b: window.innerWidth < 768 ? 50 : 60,
                l: window.innerWidth < 768 ? 50 : 60,
                r: window.innerWidth < 768 ? 40 : 60,
                t: window.innerWidth < 768 ? 40 : 50,
                pad: 10
            },
            plot_bgcolor: '#F5F5F0',
            paper_bgcolor: '#F5F5F0',
            shapes: [{
                type: 'rect',
                xref: 'paper',
                yref: 'paper',
                x0: 0,
                y0: 0,
                x1: 1,
                y1: 1,
                line: {
                    color: '#000000',
                    width: 2
                },
                fillcolor: 'transparent'
            }],
            dragmode: 'zoom',
            modebar: {
                remove: ['autoScale2d', 'lasso2d', 'select2d'],
                orientation: 'v'
            }
        };
        
        Plotly.newPlot('chart', [trace1, trace2], layout);
        
        const priceInfo = document.getElementById('priceInfo');
        const stopLossInfo = document.getElementById('stopLossInfo');
        const currentPrice = document.getElementById('currentPrice');
        const predictedPrice = document.getElementById('predictedPrice');
        const stopLoss = document.getElementById('stopLoss');

        priceInfo.style.display = 'block';
        stopLossInfo.style.display = 'block';

        currentPrice.innerHTML = `$${data.summary.current_price.toLocaleString()} (as of ${new Date().toLocaleDateString()})`;
        predictedPrice.innerHTML = `$${data.summary.final_prediction.toLocaleString()} (predicted for ${data.summary.final_date})`;

        const stopLossPrice = data.summary.current_price * 0.95;
        stopLoss.innerHTML = `$${stopLossPrice.toLocaleString()} (5% below current price)`;

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
                width: window.innerWidth < 768 ? window.innerWidth - 40 : 1100,
                margin: {
                    b: window.innerWidth < 768 ? 50 : 60,
                    l: window.innerWidth < 768 ? 50 : 60,
                    r: window.innerWidth < 768 ? 40 : 60,
                    t: window.innerWidth < 768 ? 40 : 50,
                    pad: 10
                }
            });
        }
    });
});