function getPrediction(symbol) {
    const period = document.getElementById('periodSelect').value;
    const predictDays = document.getElementById('predictPeriodSelect').value;
    $('#loading').show();
    $('#chart').hide();
    
    // Helper function to format dates
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = String(date.getDate()).padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }
    
    fetch(`/predict/${symbol}?period=${period}&predict_days=${predictDays}`)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || 'Failed to fetch prediction');
                });
            }
            return response.json();
        })
        .then(data => {
            const historical = {
                x: data.historical.dates,
                y: data.historical.prices,
                type: 'scatter',
                name: 'Historical'
            };
            
            const predictions = {
                x: data.predictions.dates,
                y: data.predictions.prices,
                type: 'scatter',
                name: 'Predictions',
                line: {
                    dash: 'dot',
                    color: 'red'
                }
            };

            const currentPrice = data.summary.current_price;
            const predictedPrice = data.summary.final_prediction;
            const priceColor = predictedPrice > currentPrice ? 'green' : 'red';
            
            const percentChange = ((predictedPrice - currentPrice) / currentPrice * 100).toFixed(2);
            const changeSymbol = percentChange >= 0 ? '+' : '';
            
            const predictedPrices = data.predictions.prices;
            const predictedDates = data.predictions.dates;
            const minIndex = predictedPrices.indexOf(Math.min(...predictedPrices));
            const maxIndex = predictedPrices.indexOf(Math.max(...predictedPrices));
            
            const buyAt = predictedPrices[minIndex].toFixed(2);
            const sellAt = predictedPrices[maxIndex].toFixed(2);
            const buyDate = formatDate(predictedDates[minIndex]);
            const sellDate = formatDate(predictedDates[maxIndex]);
            const finalDate = formatDate(data.summary.final_date);
            
            const buyTime = "04:00 GMT";
            const sellTime = "14:00 GMT";
            
            // Calculate stop loss levels (2% below buy price and 2% below predicted high)
            const buyStopLoss = (buyAt * 0.98).toFixed(2);
            const sellStopLoss = (sellAt * 0.98).toFixed(2);
            
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
                height: 800,
                autosize: true,
                margin: {
                    b: 80,
                    l: 80,
                    r: 80,
                    t: 50,
                    pad: 10
                },
                showlegend: true,
                legend: {
                    x: 0.01,
                    xanchor: 'left',
                    y: 1,
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    bordercolor: '#000000',
                    borderwidth: 1
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
            
            const config = {
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToAdd: ['drawopenpath', 'eraseshape'],
                scrollZoom: true
            };
            
            Plotly.newPlot('chart', [historical, predictions], layout, config).then(() => {
                $('#loading').hide();
                $('#chart').show();
                // Force a resize after the chart is shown
                window.dispatchEvent(new Event('resize'));
                // Add a small delay and resize again to ensure proper rendering
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                }, 100);
            });
            
            const priceInfo = `
                <div class="price-info mt-4 text-center">
                    <p class="mb-3" style="font-size: 18px; font-weight: bold;">
                        Price now: $${currentPrice}  |  Predicted price on ${finalDate}: <span style="color:${priceColor}">$${predictedPrice}</span>  
                        <span style="color:${priceColor}">(${changeSymbol}${percentChange}%)</span>
                    </p>
                    <p class="mb-2" style="font-size: 18px; font-weight: bold;">
                        Buy at: <span style="color:green">$${buyAt}</span> on ${buyDate} (Suggested time: ${buyTime})
                    </p>
                    <p class="mb-2" style="font-size: 18px; font-weight: bold;">
                        Sell at: <span style="color:red">$${sellAt}</span> on ${sellDate} (Suggested time: ${sellTime})
                    </p>
                    <div class="stop-loss-info mt-4 p-3 border rounded">
                        <h4 class="mb-3 text-light">Suggested Stop Loss Settings</h4>
                        <p class="mb-2" style="font-size: 16px;">
                            Entry Trade Stop Loss: Set at <span style="color:red">$${buyStopLoss}</span> (2% below buy price)
                        </p>
                        <p style="font-size: 16px;">
                            Profit Taking Stop Loss: Set at <span style="color:red">$${sellStopLoss}</span> (2% below predicted high)
                        </p>
                    </div>
                </div>
            `;
            
            $('.price-info').remove();
            $('#chart').after(priceInfo);
        })
        .catch(error => {
            alert('Error: ' + error.message);
            $('#loading').hide();
        });
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('predictBtn').addEventListener('click', function() {
        const symbol = document.getElementById('cryptoSelect').value;
        if (!symbol) {
            alert('Please select a cryptocurrency');
            return;
        }
        getPrediction(symbol);
    });
}); 