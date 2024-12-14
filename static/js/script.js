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

        const startPrice = data.historical.prices[data.historical.prices.length - 1];
        const endPrice = data.summary.final_prediction;
        const numPredictionPoints = data.predictions.dates.length;
        const variedPredictions = generatePriceVariations(startPrice, endPrice, numPredictionPoints);

        const historicalSeries = data.historical.prices.map((price, index) => [
            new Date(data.historical.dates[index]).getTime(),
            price
        ]);

        const predictionSeries = variedPredictions.map((price, index) => [
            new Date(data.predictions.dates[index]).getTime(),
            price
        ]);

        // Calculate date ranges for zoom
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dayAfterPrediction = new Date(finalDate);
        dayAfterPrediction.setDate(dayAfterPrediction.getDate() + 1);

        priceChart = Highcharts.chart('chart', {
            chart: {
                height: getChartHeight(),
                backgroundColor: '#FFFDE7',
                style: {
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                },
                plotBackgroundColor: '#FFFDE7',
                zoomType: 'x',
                events: {
                    load: function() {
                        this.chartBackground.css({
                            fill: '#FFFDE7'
                        });
                        this.xAxis[0].setExtremes(
                            yesterday.getTime(),
                            dayAfterPrediction.getTime()
                        );
                    }
                }
            },
            title: {
                text: `${symbol} Price Prediction`,
                style: {
                    fontSize: window.innerWidth < 768 ? '14px' : '18px',
                    color: '#000000'
                }
            },
            xAxis: {
                type: 'datetime',
                labels: {
                    format: '{value:%e %b %Y}',
                    style: {
                        fontSize: window.innerWidth < 768 ? '10px' : '12px'
                    }
                },
                min: yesterday.getTime(),
                max: dayAfterPrediction.getTime(),
                events: {
                    afterSetExtremes: function(e) {
                        if (!e.trigger) {
                            this.setExtremes(
                                yesterday.getTime(),
                                dayAfterPrediction.getTime()
                            );
                        }
                    }
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
            },
            rangeSelector: {
                enabled: true,
                buttons: [{
                    type: 'day',
                    count: 7,
                    text: '1W'
                }, {
                    type: 'month',
                    count: 1,
                    text: '1M'
                }, {
                    type: 'month',
                    count: 3,
                    text: '3M'
                }, {
                    type: 'month',
                    count: 6,
                    text: '6M'
                }, {
                    type: 'year',
                    count: 1,
                    text: '1Y'
                }, {
                    type: 'all',
                    text: 'All'
                }],
                selected: 0
            }
        });

        const priceInfo = document.getElementById('priceInfo');
        const stopLossInfo = document.getElementById('stopLossInfo');
        const currentPriceElement = document.getElementById('currentPrice');
        const predictedPriceElement = document.getElementById('predictedPrice');

        priceInfo.style.display = 'block';
        stopLossInfo.style.display = 'block';

        currentPriceElement.innerHTML = `$${formatPrice(data.summary.current_price)} (as of ${currentDate})`;

        const currentPrice = data.summary.current_price;
        const predictedPrice = data.summary.final_prediction;
        const percentChange = ((predictedPrice - currentPrice) / currentPrice) * 100;

        // Add color class to the entire predicted price element
        predictedPriceElement.className = predictedPrice > currentPrice ? 'text-success' : 'text-danger';
        predictedPriceElement.innerHTML = `$${formatPrice(predictedPrice)} (predicted for ${formatDate(finalDate)})`;

        const stopLoss = currentPrice * 0.95; // 5% below current price

        let tradingAdvice = '';
        if (percentChange > 5) {
            tradingAdvice = `
                <div class="row">
                    <div class="col-12">
                        <h5 class="text-dark mb-3">AI Trading Recommendations for ${symbol}</h5>
                        <div class="card mb-3">
                            <div class="card-body bg-white">
                                <h6 class="text-dark">If you own ${symbol}:</h6>
                                <p class="text-success fw-bold">HOLD → Consider selling at $${formatPrice(predictedPrice)} (${percentChange.toFixed(2)}% potential gain)</p>
                                <p class="text-danger fw-bold">Set stop-loss at $${formatPrice(stopLoss)}</p>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-body bg-white">
                                <h6 class="text-dark">If you don't own ${symbol}:</h6>
                                <p class="text-primary fw-bold">WAIT → Consider buying if price dips below $${formatPrice(currentPrice * 0.98)}</p>
                            </div>
                        </div>
                    </div>
                </div>`;
        } else if (percentChange < -5) {
            tradingAdvice = `
                <div class="row">
                    <div class="col-12">
                        <h5 class="text-dark mb-3">AI Trading Recommendations for ${symbol}</h5>
                        <div class="card mb-3">
                            <div class="card-body bg-white">
                                <h6 class="text-dark">If you own ${symbol}:</h6>
                                <p class="text-danger fw-bold">SELL → Price expected to drop to $${formatPrice(predictedPrice)} (${percentChange.toFixed(2)}% potential loss)</p>
                                <p class="text-danger fw-bold">Set stop-loss at $${formatPrice(stopLoss)}</p>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-body bg-white">
                                <h6 class="text-dark">If you don't own ${symbol}:</h6>
                                <p class="text-primary fw-bold">WAIT → Consider buying after price stabilizes below $${formatPrice(predictedPrice)}</p>
                            </div>
                        </div>
                    </div>
                </div>`;
        } else {
            tradingAdvice = `
                <div class="row">
                    <div class="col-12">
                        <h5 class="text-dark mb-3">AI Trading Recommendations for ${symbol}</h5>
                        <div class="card mb-3">
                            <div class="card-body bg-white">
                                <h6 class="text-dark">If you own ${symbol}:</h6>
                                <p class="text-primary fw-bold">HOLD → Price expected to remain stable around $${formatPrice(currentPrice)}</p>
                                <p class="text-danger fw-bold">Set stop-loss at $${formatPrice(stopLoss)}</p>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-body bg-white">
                                <h6 class="text-dark">If you don't own ${symbol}:</h6>
                                <p class="text-primary fw-bold">NEUTRAL → Consider small positions if price drops below $${formatPrice(currentPrice * 0.98)}</p>
                            </div>
                        </div>
                    </div>
                </div>`;
        }

        stopLossInfo.innerHTML = tradingAdvice;

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
    
    window.addEventListener('resize', function() {
        if (priceChart) {
            priceChart.setSize(null, getChartHeight());
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dayAfterPrediction = new Date();
            dayAfterPrediction.setDate(dayAfterPrediction.getDate() + parseInt(document.getElementById('predictPeriodSelect').value) + 1);
            priceChart.xAxis[0].setExtremes(
                yesterday.getTime(),
                dayAfterPrediction.getTime()
            );
        }
    });
});