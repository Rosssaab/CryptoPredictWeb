function getChartHeight() {
    return window.innerWidth < 768 ? 250 : 600;
}

function generatePriceVariations(startPrice, endPrice, numPoints) {
    const prices = [];
    const trend = endPrice - startPrice;
    const volatility = Math.abs(trend) * 0.15;

    for (let i = 0; i < numPoints; i++) {
        const progress = i / (numPoints - 1);
        const basePrice = startPrice + (trend * progress);
        const variation = (Math.random() - 0.5) * volatility;
        const maxVariation = Math.abs(trend * 0.1);
        const boundedVariation = Math.max(Math.min(variation, maxVariation), -maxVariation);
        prices.push(basePrice + boundedVariation);
    }

    prices[0] = startPrice;
    prices[prices.length - 1] = endPrice;
    
    return prices;
}

let priceChart = null;

async function updateChart() {
    const symbol = document.getElementById('cryptoSelect').value;
    const period = document.getElementById('periodSelect').value;
    const predictPeriod = parseInt(document.getElementById('predictPeriodSelect').value);
    
    if (!symbol) return;
    
    document.getElementById('loading').style.display = 'block';
    
    // Destroy existing chart if it exists
    if (priceChart) {
        priceChart.destroy();
    }

    const formatDate = (date) => {
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const now = new Date();
    const currentDate = formatDate(now);
    const finalDate = new Date(now);
    finalDate.setDate(now.getDate() + predictPeriod);

    const formatPrice = (price) => {
        return price.toLocaleString('en-US', {
            minimumFractionDigits: 6,
            maximumFractionDigits: 6
        });
    };

    try {
        const response = await fetch(`/CryptoPrediction/predict/${symbol}?period=${period}&predict_days=${predictPeriod}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        // Generate varied predictions
        const startPrice = data.historical.prices[data.historical.prices.length - 1];
        const endPrice = data.summary.final_prediction;
        const numPredictionPoints = data.predictions.dates.length;
        const variedPredictions = generatePriceVariations(startPrice, endPrice, numPredictionPoints);

        // Prepare data series
        const historicalSeries = data.historical.prices.map((price, index) => [
            new Date(data.historical.dates[index]).getTime(),
            price
        ]);

        const predictionSeries = variedPredictions.map((price, index) => [
            new Date(data.predictions.dates[index]).getTime(),
            price
        ]);

        // Highcharts configuration
        priceChart = Highcharts.chart('chart', {
            chart: {
                height: getChartHeight(),
                backgroundColor: 'transparent',
                style: {
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                }
            },
            title: {
                text: `${symbol} Price Prediction`,
                style: {
                    fontSize: window.innerWidth < 768 ? '14px' : '18px'
                }
            },
            xAxis: {
                type: 'datetime',
                labels: {
                    format: '{value:%e %b %Y}'
                }
            },
            yAxis: {
                title: {
                    text: 'Price (USD)'
                },
                labels: {
                    formatter: function() {
                        return '$' + formatPrice(this.value);
                    }
                }
            },
            tooltip: {
                shared: true,
                formatter: function() {
                    let tooltip = '<b>' + Highcharts.dateFormat('%e %b %Y', this.x) + '</b><br/>';
                    this.points.forEach(point => {
                        tooltip += `${point.series.name}: <b>$${formatPrice(point.y)}</b><br/>`;
                    });
                    return tooltip;
                }
            },
            series: [{
                name: 'Historical',
                data: historicalSeries,
                color: '#2C3E50',
                lineWidth: 2
            }, {
                name: 'AI Predictions',
                data: predictionSeries,
                color: '#E74C3C',
                dashStyle: 'Dash',
                lineWidth: 2
            }],
            responsive: {
                rules: [{
                    condition: {
                        maxWidth: 768
                    },
                    chartOptions: {
                        legend: {
                            enabled: true,
                            layout: 'horizontal',
                            align: 'center',
                            verticalAlign: 'bottom'
                        }
                    }
                }]
            },
            plotOptions: {
                series: {
                    animation: {
                        duration: 1000
                    },
                    marker: {
                        enabled: false
                    }
                }
            },
            credits: {
                enabled: false
            }
        });

        // Update price displays
        const priceInfo = document.getElementById('priceInfo');
        const stopLossInfo = document.getElementById('stopLossInfo');
        const currentPrice = document.getElementById('currentPrice');
        const predictedPrice = document.getElementById('predictedPrice');

        priceInfo.style.display = 'block';
        stopLossInfo.style.display = 'block';

        currentPrice.innerHTML = `$${formatPrice(data.summary.current_price)} (as of ${currentDate})`;
        predictedPrice.innerHTML = `$${formatPrice(data.summary.final_prediction)} (predicted for ${formatDate(finalDate)})`;

        // Trading recommendations
        stopLossInfo.innerHTML = `
            <h5>AI Trading Recommendations</h5>
            <p>Current Price: <strong>$${formatPrice(data.summary.current_price)}</strong></p>
            <p>Predicted Price: <strong>$${formatPrice(data.summary.final_prediction)}</strong></p>
            <p>Recommended Stop-Loss: <strong>$${formatPrice(data.summary.current_price * 0.95)}</strong></p>
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
    $('#cryptoSelect').select2({
        theme: 'classic',
        placeholder: 'Search for a cryptocurrency...',
        allowClear: true,
        width: '100%',
        dropdownParent: $('.controls'),
        templateResult: formatCrypto,
        templateSelection: formatCrypto
    });

    function formatCrypto(crypto) {
        if (!crypto.id) return crypto.text;
        return $(`<span><strong>${crypto.text}</strong></span>`);
    }

    document.getElementById('predictBtn').addEventListener('click', updateChart);
    
    // Handle resize
    window.addEventListener('resize', function() {
        if (priceChart) {
            priceChart.setSize(null, getChartHeight());
        }
    });
});