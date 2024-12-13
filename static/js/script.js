function getChartHeight() {
    return window.innerWidth < 768 ? 250 : 600;
}

function getChartWidth() {
    if (window.innerWidth < 768) {
        // For mobile, use the container width minus padding
        const container = document.querySelector('.container');
        return container.clientWidth - 40; // Account for container padding
    }
    return 980;
}

function analyze2HourSamples(historicalPrices, historicalDates) {
    // Group data into 2-hour intervals
    const samples = [];
    for (let i = 0; i < historicalPrices.length; i += 2) {
        samples.push({
            startPrice: historicalPrices[i],
            endPrice: historicalPrices[i + 1] || historicalPrices[i],
            timestamp: new Date(historicalDates[i]),
            priceChange: ((historicalPrices[i + 1] || historicalPrices[i]) - historicalPrices[i]) / historicalPrices[i] * 100
        });
    }

    // Analyze patterns
    const analysis = {
        bestBuyHour: 0,
        bestSellHour: 0,
        volatilityByHour: new Array(12).fill(0), // 12 2-hour periods in a day
        averageSwing: 0,
        highVolatilityPeriods: []
    };

    // Calculate volatility and price swings for each 2-hour period
    samples.forEach(sample => {
        const hour = sample.timestamp.getHours();
        const periodIndex = Math.floor(hour / 2);
        analysis.volatilityByHour[periodIndex] += Math.abs(sample.priceChange);
        
        if (Math.abs(sample.priceChange) > 1) { // More than 1% change
            analysis.highVolatilityPeriods.push({
                hour: hour,
                change: sample.priceChange
            });
        }
    });

    // Find best trading hours based on historical patterns
    analysis.volatilityByHour = analysis.volatilityByHour.map((vol, index) => ({
        period: `${index * 2}:00-${(index * 2 + 2)}:00`,
        volatility: vol / (samples.length / 12) // Average volatility for this period
    }));

    // Sort periods by volatility to find best trading times
    const sortedPeriods = [...analysis.volatilityByHour]
        .sort((a, b) => b.volatility - a.volatility);

    analysis.bestTradingPeriods = sortedPeriods.slice(0, 3);
    analysis.averageSwing = samples.reduce((acc, sample) => 
        acc + Math.abs(sample.priceChange), 0) / samples.length;

    return analysis;
}

function calculateFibonacciPredictions(currentPrice, historicalPrices) {
    const highPrice = Math.max(...historicalPrices);
    const lowPrice = Math.min(...historicalPrices);
    
    // Calculate Fibonacci retracement levels
    const fibLevels = {
        extension1618: currentPrice + (highPrice - lowPrice) * 1.618,
        extension1272: currentPrice + (highPrice - lowPrice) * 1.272,
        extension1000: highPrice,
        retracement618: lowPrice + (highPrice - lowPrice) * 0.618,
        retracement500: lowPrice + (highPrice - lowPrice) * 0.5,
        retracement382: lowPrice + (highPrice - lowPrice) * 0.382,
        retracement236: lowPrice + (highPrice - lowPrice) * 0.236
    };

    // Determine trend direction
    const recentPrices = historicalPrices.slice(-5);
    const trend = recentPrices[recentPrices.length - 1] > recentPrices[0] ? 'upward' : 'downward';

    // Predict next price targets based on trend
    let primaryTarget, secondaryTarget;
    if (trend === 'upward') {
        primaryTarget = fibLevels.extension1272;
        secondaryTarget = fibLevels.extension1618;
    } else {
        primaryTarget = fibLevels.retracement382;
        secondaryTarget = fibLevels.retracement618;
    }

    return {
        trend,
        levels: fibLevels,
        targets: {
            primary: primaryTarget,
            secondary: secondaryTarget
        },
        stopLoss: trend === 'upward' ? fibLevels.retracement382 : fibLevels.extension1000
    };
}

function generatePriceVariations(startPrice, endPrice, numPoints) {
    const prices = [];
    const trend = endPrice - startPrice;
    const volatility = Math.abs(trend) * 0.15; // 15% of total trend as volatility

    for (let i = 0; i < numPoints; i++) {
        // Calculate base progression along the trend
        const progress = i / (numPoints - 1);
        const basePrice = startPrice + (trend * progress);
        
        // Add randomized variations
        const variation = (Math.random() - 0.5) * volatility;
        
        // Ensure variations follow overall trend
        const maxVariation = Math.abs(trend * 0.1); // Limit extreme variations
        const boundedVariation = Math.max(Math.min(variation, maxVariation), -maxVariation);
        
        prices.push(basePrice + boundedVariation);
    }

    // Ensure first and last prices match our targets
    prices[0] = startPrice;
    prices[prices.length - 1] = endPrice;
    
    return prices;
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

    // Add a price formatting function at the start of updateChart
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

        // Get Fibonacci analysis and time analysis first
        const timeAnalysis = analyze2HourSamples(data.historical.prices, data.historical.dates);
        const fibAnalysis = calculateFibonacciPredictions(
            data.summary.current_price,
            data.historical.prices
        );

        // Generate varied predictions
        const startPrice = data.historical.prices[data.historical.prices.length - 1];
        const endPrice = data.summary.final_prediction;
        const numPredictionPoints = data.predictions.dates.length;
        const variedPredictions = generatePriceVariations(startPrice, endPrice, numPredictionPoints);

        // Calculate date ranges
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const finalPredictionDate = new Date(data.predictions.dates[data.predictions.dates.length - 1]);
        const dayAfterPrediction = new Date(finalPredictionDate);
        dayAfterPrediction.setDate(finalPredictionDate.getDate() + 1);

        // Define all traces in one place
        const plotData = [
            {
                x: data.historical.dates,
                y: data.historical.prices,
                name: 'Historical',
                type: 'scatter',
                line: {
                    color: '#2C3E50'
                },
                showlegend: true
            },
            {
                x: data.predictions.dates,
                y: variedPredictions,
                name: 'Predictions',
                type: 'scatter',
                line: {
                    color: '#E74C3C',
                    dash: 'dot'
                },
                showlegend: true
            }
        ];

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
                },
                range: [
                    yesterday.toISOString().split('T')[0],
                    dayAfterPrediction.toISOString().split('T')[0]
                ],
                type: 'date'
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
                b: window.innerWidth < 768 ? 10 : 60,
                l: window.innerWidth < 768 ? 20 : 60,
                r: window.innerWidth < 768 ? 10 : 60,
                t: window.innerWidth < 768 ? 10 : 50,
                pad: window.innerWidth < 768 ? 0 : 4
            },
            plot_bgcolor: '#F5F5F0',
            paper_bgcolor: '#F5F5F0'
        };
        
        Plotly.newPlot('chart', plotData, layout, {
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

        currentPrice.innerHTML = `$${formatPrice(data.summary.current_price)} (as of ${currentDate})`;
        predictedPrice.innerHTML = `$${formatPrice(data.summary.final_prediction)} (predicted for ${formatDate(finalDate)})`;

        // Update trading recommendations with time analysis
        stopLossInfo.innerHTML = `
            <h5>Trading Recommendations (Time-Enhanced)</h5>
            <p>Market Trend: <strong>${fibAnalysis.trend}</strong></p>
            <p>Primary Target: <strong>$${formatPrice(fibAnalysis.targets.primary)}</strong></p>
            <p>Secondary Target: <strong>$${formatPrice(fibAnalysis.targets.secondary)}</strong></p>
            <p>Recommended Stop-Loss: <strong>$${formatPrice(fibAnalysis.stopLoss)}</strong></p>
            <h6>Best Trading Periods (GMT):</h6>
            <ul>
                ${timeAnalysis.bestTradingPeriods.map(period => 
                    `<li>${period.period} (Volatility: ${period.volatility.toFixed(2)}%)</li>`
                ).join('')}
            </ul>
            <p>Average 2-Hour Price Swing: <strong>${timeAnalysis.averageSwing.toFixed(2)}%</strong></p>
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
    // Initialize Select2
    $('#cryptoSelect').select2({
        theme: 'classic',
        placeholder: 'Search for a cryptocurrency...',
        allowClear: true,
        width: '100%',
        dropdownParent: $('.controls'),
        templateResult: formatCrypto,
        templateSelection: formatCrypto
    });

    // Format the crypto options
    function formatCrypto(crypto) {
        if (!crypto.id) return crypto.text;
        return $(`<span><strong>${crypto.text}</strong></span>`);
    }

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