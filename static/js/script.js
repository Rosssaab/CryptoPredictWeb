function getPrediction(symbol) {
    const period = document.getElementById('periodSelect').value;
    const predictDays = document.getElementById('predictPeriodSelect').value;
    $('#loading').show();
    $('#chart').hide();
    
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
            
            // Calculate percentage change
            const percentChange = ((predictedPrice - currentPrice) / currentPrice * 100).toFixed(2);
            const changeSymbol = percentChange >= 0 ? '+' : '';
            
            const predictedPrices = data.predictions.prices;
            const predictedDates = data.predictions.dates;
            const minIndex = predictedPrices.indexOf(Math.min(...predictedPrices));
            const maxIndex = predictedPrices.indexOf(Math.max(...predictedPrices));
            
            const buyAt = predictedPrices[minIndex].toFixed(2);
            const sellAt = predictedPrices[maxIndex].toFixed(2);
            const buyDate = predictedDates[minIndex];
            const sellDate = predictedDates[maxIndex];
            
            const buyTime = "04:00 GMT";
            const sellTime = "14:00 GMT";
            
            const layout = {
                title: `${symbol} Price Prediction`,
                xaxis: { 
                    title: 'Date',
                    showline: true,
                    linewidth: 2,
                    linecolor: 'black',
                    rangeslider: { visible: true }
                },
                yaxis: { 
                    title: 'Price (USD)',
                    showline: true,
                    linewidth: 2,
                    linecolor: 'black',
                    fixedrange: false
                },
                height: 600,
                margin: {
                    b: 50,
                    l: 80,
                    r: 50,
                    t: 50
                },
                showlegend: true,
                legend: {
                    x: 0.01,
                    xanchor: 'left',
                    y: 1,
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    bordercolor: 'black',
                    borderwidth: 1
                },
                plot_bgcolor: 'white',
                paper_bgcolor: 'white',
                shapes: [{
                    type: 'rect',
                    xref: 'paper',
                    yref: 'paper',
                    x0: 0,
                    y0: 0,
                    x1: 1,
                    y1: 1,
                    line: {
                        color: 'black',
                        width: 2
                    }
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
            
            Plotly.newPlot('chart', [historical, predictions], layout, config);
            
            // Update price information below the chart
            const priceInfo = `
                <div class="price-info mt-4 text-center">
                    <p class="mb-3" style="font-size: 18px; font-weight: bold;">
                        Price now: $${currentPrice}  |  Predicted price on ${data.summary.final_date}: <span style="color:${priceColor}">$${predictedPrice}</span>  
                        <span style="color:${priceColor}">(${changeSymbol}${percentChange}%)</span>
                    </p>
                    <p class="mb-2" style="font-size: 18px; font-weight: bold;">
                        Buy at: <span style="color:green">$${buyAt}</span> on ${buyDate} (Suggested time: ${buyTime})
                    </p>
                    <p style="font-size: 18px; font-weight: bold;">
                        Sell at: <span style="color:red">$${sellAt}</span> on ${sellDate} (Suggested time: ${sellTime})
                    </p>
                </div>
            `;
            
            // Remove any existing price info and add the new one
            $('.price-info').remove();
            $('#chart').after(priceInfo);
            
            $('#loading').hide();
            $('#chart').show();
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