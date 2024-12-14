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

let priceChart = null; // Global chart reference

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
        const historicalSeries = data.historical.prices.map((price, index) => ({
            x: new Date(data.historical.dates[index]).getTime(),
            y: price
        }));

        const predictionSeries = variedPredictions.map((price, index) => ({
            x: new Date(data.predictions.dates[index]).getTime(),
            y: price
        }));

        // ApexCharts configuration
        const options = {
            series: [{
                name: 'Historical',
                data: historicalSeries
            }, {
                name: 'AI Predictions',
                data: predictionSeries
            }],
            chart: {
                type: 'line',
                height: getChartHeight(),
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800
                },
                toolbar: {
                    show: window.innerWidth >= 768,
                    tools: {
                        download: true,
                        selection: true,
                        zoom: true,
                        zoomin: true,
                        zoomout: true,
                        pan: true,
                        reset: true
                    }
                },
                zoom: {
                    enabled: window.innerWidth >= 768
                }
            },
            stroke: {
                curve: 'smooth',
                width: [2, 2],
                dashArray: [0, 5]
            },
            colors: ['#2C3E50', '#E74C3C'],
            title: {
                text: `${symbol} Price Prediction`,
                align: 'left',
                style: {
                    fontSize: window.innerWidth < 768 ? '14px' : '18px',
                    color: '#fff'
                }
            },
            xaxis: {
                type: 'datetime',
                labels: {
                    style: {
                        colors: '#fff'
                    },
                    datetimeFormatter: {
                        year: 'yyyy',
                        month: 'MMM \'yy',
                        day: 'dd MMM',
                        hour: 'HH:mm'
                    }
                }
            },
            yaxis: {
                labels: {
                    style: {
                        colors: '#fff'
                    },
                    formatter: function(value) {
                        return '$' + formatPrice(value);
                    }
                },
                title: {
                    text: 'Price (USD)',
                    style: {
                        color: '#fff'
                    }
                }
            },
            tooltip: {
                shared: true,
                x: {
                    format: 'dd MMM yyyy'
                },
                y: {
                    formatter: function(value) {
                        return '$' + formatPrice(value);
                    }
                }
            },
            grid: {
                borderColor: '#334455',
                strokeDashArray: 5,
            },
            legend: {
                position: 'top',
                horizontalAlign: 'right',
                labels: {
                    colors: '#fff'
                }
            },
            theme: {
                mode: 'dark'
            }
        };

        // Create new chart
        priceChart = new ApexCharts(document.querySelector("#chart"), options);
        priceChart.render();

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
            priceChart.updateOptions({
                chart: {
                    height: getChartHeight()
                },
                title: {
                    style: {
                        fontSize: window.innerWidth < 768 ? '14px' : '18px'
                    }
                }
            });
        }
    });
});