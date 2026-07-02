import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Alert, Pressable } from 'react-native';
import { Card, Text, useTheme, SegmentedButtons, IconButton, List, Divider } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle, Line, Rect, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getExpenses, getCategories, Expense, Category } from '../db/database';
import {
  format,
  subMonths,
  addMonths,
  parseISO,
  isSameMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  subWeeks,
  isSameDay,
  endOfMonth,
  getDaysInMonth,
} from 'date-fns';
import { formatRupee } from './HistoryScreen';

const screenWidth = Dimensions.get('window').width;
const chartWidth = screenWidth - 32;
const chartHeight = 180;
const paddingLeft = 40;
const paddingRight = 16;
const paddingTop = 16;
const paddingBottom = 24;

export default function AnalyticsScreen() {
  const theme = useTheme();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [timePeriod, setTimePeriod] = useState<'week' | 'month'>('week');
  
  // Selected Month Pager state
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const loadData = useCallback(() => {
    try {
      setExpenses(getExpenses());
      setCategories(getCategories());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useFocusEffect(loadData);

  const handlePrevMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    if (isSameMonth(selectedMonth, new Date())) return;
    setSelectedMonth(prev => addMonths(prev, 1));
  };

  const isNextDisabled = isSameMonth(selectedMonth, new Date());

  // 1. Calculations for Monthly Trend (Last 6 Months ending in selectedMonth)
  const monthsData: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(selectedMonth, i);
    const monthLabel = format(monthDate, 'MMM');
    const total = expenses
      .filter((e) => isSameMonth(parseISO(e.date), monthDate))
      .reduce((sum, e) => sum + e.amount, 0);
    monthsData.push({ label: monthLabel, value: total });
  }

  // 2. Calculations for Weekly Day-by-Day Comparison inside selectedMonth
  const isCurrentMonth = isSameMonth(selectedMonth, new Date());
  const refDate = isCurrentMonth ? new Date() : endOfMonth(selectedMonth);
  
  const startOfCurrentWeek = startOfWeek(refDate, { weekStartsOn: 1 }); // Monday
  const endOfCurrentWeek = endOfWeek(refDate, { weekStartsOn: 1 });
  const startOfLastWeek = startOfWeek(subWeeks(refDate, 1), { weekStartsOn: 1 });
  const endOfLastWeek = endOfWeek(subWeeks(refDate, 1), { weekStartsOn: 1 });

  const currentWeekDays = eachDayOfInterval({ start: startOfCurrentWeek, end: endOfCurrentWeek });
  const lastWeekDays = eachDayOfInterval({ start: startOfLastWeek, end: endOfLastWeek });

  const weeklyComparisonData = currentWeekDays.map((day, idx) => {
    const label = format(day, 'EEE').substring(0, 3);
    const currentVal = expenses
      .filter((e) => isSameDay(parseISO(e.date), day))
      .reduce((sum, e) => sum + e.amount, 0);
    const lastVal = expenses
      .filter((e) => isSameDay(parseISO(e.date), lastWeekDays[idx]))
      .reduce((sum, e) => sum + e.amount, 0);
    return { label, current: currentVal, last: lastVal };
  });

  // 3. Stats for Selected Month
  const thisMonthExpenses = expenses.filter((e) => isSameMonth(parseISO(e.date), selectedMonth));
  const totalThisMonth = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  const daysInMonth = isCurrentMonth ? new Date().getDate() : getDaysInMonth(selectedMonth);
  const avgDailySpending = thisMonthExpenses.length > 0 ? (totalThisMonth / daysInMonth) : 0;

  // Find top spending category for the selected month
  const categoryTotals = categories.map((cat) => {
    const total = thisMonthExpenses
      .filter((e) => e.category === cat.name)
      .reduce((sum, e) => sum + e.amount, 0);
    return { name: cat.name, total };
  });
  const sortedCategories = [...categoryTotals].sort((a, b) => b.total - a.total);
  const topCategory = sortedCategories.length > 0 && sortedCategories[0].total > 0 ? sortedCategories[0].name : 'N/A';
  const topCategoryTotal = sortedCategories.length > 0 ? sortedCategories[0].total : 0;

  // Monthly breakdown calculation
  const categoryBreakdown = categories.map(cat => {
    const amount = thisMonthExpenses
      .filter(e => e.category === cat.name)
      .reduce((sum, e) => sum + e.amount, 0);
    const percentage = totalThisMonth > 0 ? (amount / totalThisMonth) : 0;
    return { category: cat.name, color: cat.color, amount, percentage };
  })
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  // PDF Report Generation
  const handleGeneratePDF = async () => {
    if (thisMonthExpenses.length === 0) {
      Alert.alert('No expenses', 'There are no expenses to report for this month.');
      return;
    }

    try {
      const monthTitle = format(selectedMonth, 'MMMM yyyy');
      
      const categoryRows = categoryBreakdown.map(item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">
            <span style="display:inline-block; width:12px; height:12px; border-radius:6px; background-color:${item.color}; margin-right:8px;"></span>
            ${item.category}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${Math.round(item.percentage * 100)}%</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">₹${item.amount.toFixed(2)}</td>
        </tr>
      `).join('');

      const transactionRows = thisMonthExpenses.map(expense => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${format(parseISO(expense.date), 'MMM dd, yyyy')}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${expense.category}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${expense.description || '—'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #e74c3c;">-₹${expense.amount.toFixed(2)}</td>
        </tr>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Expense Report - ${monthTitle}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2980b9; padding-bottom: 20px; }
            .title { margin: 0; font-size: 28px; color: #2c3e50; }
            .subtitle { margin: 5px 0 0 0; font-size: 16px; color: #7f8c8d; }
            .summary-box { display: flex; justify-content: space-between; margin-bottom: 30px; gap: 20px; }
            .card { flex: 1; background: #f8f9fa; border-radius: 8px; padding: 15px; border: 1px solid #e9ecef; text-align: center; }
            .card-title { font-size: 12px; text-transform: uppercase; color: #6c757d; margin-bottom: 5px; }
            .card-value { font-size: 20px; font-weight: bold; color: #2c3e50; }
            h2 { font-size: 18px; color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background-color: #f1f2f6; text-align: left; padding: 10px; border-bottom: 2px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">Monthly Expense Report</h1>
            <p class="subtitle">${monthTitle}</p>
          </div>
          
          <div class="summary-box">
            <div class="card">
              <div class="card-title">Total Spending</div>
              <div class="card-value">₹${totalThisMonth.toFixed(2)}</div>
            </div>
            <div class="card">
              <div class="card-title">Daily Average</div>
              <div class="card-value">₹${avgDailySpending.toFixed(2)}</div>
            </div>
            <div class="card">
              <div class="card-title">Top Category</div>
              <div class="card-value">${topCategory}</div>
            </div>
          </div>
          
          <h2>Category Breakdown</h2>
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Category</th>
                <th style="text-align: right;">Percentage</th>
                <th style="text-align: right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${categoryRows}
            </tbody>
          </table>
          
          <h2>All Transactions</h2>
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Date</th>
                <th style="text-align: left;">Category</th>
                <th style="text-align: left;">Description</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${transactionRows}
            </tbody>
          </table>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Expense Report - ${monthTitle}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Error', 'Sharing is not supported on this device.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to generate PDF report.');
    }
  };

  // Render dynamic Trend Line Chart
  const renderTrendChart = () => {
    const maxVal = Math.max(...monthsData.map((d) => d.value), 1000);
    const effectiveWidth = chartWidth - paddingLeft - paddingRight;
    const effectiveHeight = chartHeight - paddingTop - paddingBottom;

    let pointsPath = '';
    let areaPath = '';

    const points = monthsData.map((d, idx) => {
      const x = paddingLeft + (idx * effectiveWidth) / (monthsData.length - 1);
      const y = chartHeight - paddingBottom - (d.value * effectiveHeight) / maxVal;
      return { x, y };
    });

    if (points.length > 0) {
      pointsPath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
      areaPath = `${pointsPath} L ${points[points.length - 1].x} ${chartHeight - paddingBottom} L ${points[0].x} ${chartHeight - paddingBottom} Z`;
    }

    return (
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={theme.colors.primary} stopOpacity={0.4} />
              <Stop offset="100%" stopColor={theme.colors.primary} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
            const y = paddingTop + p * effectiveHeight;
            const gridVal = maxVal * (1 - p);
            return (
              <G key={idx}>
                <Line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke={theme.colors.surfaceVariant}
                  strokeWidth={1}
                />
                <Text
                  style={[
                    styles.yAxisLabel,
                    {
                      transform: [
                        { translateX: 4 },
                        { translateY: y + 4 },
                      ],
                    },
                  ]}
                >
                  ₹{Math.round(gridVal)}
                </Text>
              </G>
            );
          })}

          {/* Area fill */}
          {areaPath !== '' && <Path d={areaPath} fill="url(#gradient)" />}

          {/* Trend Line */}
          {pointsPath !== '' && (
            <Path
              d={pointsPath}
              fill="none"
              stroke={theme.colors.primary}
              strokeWidth={3}
            />
          )}

          {/* Dots */}
          {points.map((p, idx) => (
            <G key={idx}>
              <Circle
                cx={p.x}
                cy={p.y}
                r={4}
                fill={theme.colors.primary}
              />
              <Text
                style={[
                  styles.xAxisLabel,
                  {
                    transform: [
                      { translateX: p.x - 12 },
                      { translateY: chartHeight - 8 },
                    ],
                  },
                ]}
              >
                {monthsData[idx].label}
              </Text>
            </G>
          ))}
        </Svg>
      </View>
    );
  };

  // Render dynamic Weekly Comparison Bar Chart
  const renderWeeklyComparisonChart = () => {
    const maxVal = Math.max(
      ...weeklyComparisonData.map((d) => Math.max(d.current, d.last)),
      1000
    );
    const effectiveWidth = chartWidth - paddingLeft - paddingRight;
    const effectiveHeight = chartHeight - paddingTop - paddingBottom;
    const numDays = weeklyComparisonData.length;
    const groupWidth = effectiveWidth / numDays;
    const barWidth = 8;

    return (
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
            const y = paddingTop + p * effectiveHeight;
            const gridVal = maxVal * (1 - p);
            return (
              <G key={idx}>
                <Line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke={theme.colors.surfaceVariant}
                  strokeWidth={1}
                />
                <Text
                  style={[
                    styles.yAxisLabel,
                    {
                      transform: [
                        { translateX: 4 },
                        { translateY: y + 4 },
                      ],
                    },
                  ]}
                >
                  ₹{Math.round(gridVal)}
                </Text>
              </G>
            );
          })}

          {/* Bars */}
          {weeklyComparisonData.map((d, idx) => {
            const groupX = paddingLeft + idx * groupWidth;
            const centerX = groupX + groupWidth / 2;
            const currentHeight = (d.current / maxVal) * effectiveHeight;
            const lastHeight = (d.last / maxVal) * effectiveHeight;

            const currentY = chartHeight - paddingBottom - currentHeight;
            const lastY = chartHeight - paddingBottom - lastHeight;

            return (
              <G key={idx}>
                {/* Last Week Bar (Secondary/Translucent) */}
                <Rect
                  x={centerX - barWidth - 2}
                  y={lastY}
                  width={barWidth}
                  height={lastHeight}
                  fill={theme.colors.outlineVariant}
                  rx={2}
                />
                {/* This Week Bar (Primary Color) */}
                <Rect
                  x={centerX + 2}
                  y={currentY}
                  width={barWidth}
                  height={currentHeight}
                  fill={theme.colors.primary}
                  rx={2}
                />
                {/* X Axis Label */}
                <Text
                  style={[
                    styles.xAxisLabel,
                    {
                      transform: [
                        { translateX: centerX - 10 },
                        { translateY: chartHeight - 8 },
                      ],
                    },
                  ]}
                >
                  {d.label}
                </Text>
              </G>
            );
          })}
        </Svg>
      </View>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Month Selection Pager & PDF Button */}
      <View style={styles.monthPagerRow}>
        <IconButton
          icon="chevron-left"
          size={24}
          onPress={handlePrevMonth}
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="titleMedium" style={styles.monthLabel}>
            {format(selectedMonth, 'MMMM yyyy')}
          </Text>
        </View>
        <IconButton
          icon="chevron-right"
          size={24}
          onPress={handleNextMonth}
          disabled={isNextDisabled}
        />
        <IconButton
          icon="file-pdf-box"
          size={24}
          iconColor={theme.colors.error}
          onPress={handleGeneratePDF}
        />
      </View>

      {/* Time Frame selector */}
      <View style={styles.selectorContainer}>
        <SegmentedButtons
          value={timePeriod}
          onValueChange={(val: any) => setTimePeriod(val)}
          buttons={[
            { value: 'week', label: 'Weekly Spending' },
            { value: 'month', label: '6-Month Trend' },
          ]}
        />
      </View>

      {/* Chart Section */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 12 }}>
            {timePeriod === 'week' ? 'Weekly Spending Comparison' : '6-Month Spending Trend'}
          </Text>
          {timePeriod === 'week' ? renderWeeklyComparisonChart() : renderTrendChart()}
          {timePeriod === 'week' && (
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.outlineVariant }]} />
                <Text variant="bodySmall">Last Week</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
                <Text variant="bodySmall">This Week</Text>
              </View>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Analytics Insights Summary cards */}
      <Text variant="titleLarge" style={styles.sectionTitle}>Spending Insights</Text>
      
      <View style={styles.statsGrid}>
        <Card style={[styles.statsCard, { flex: 1, marginRight: 8 }]}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.statsLabel}>Daily Average</Text>
            <Text variant="headlineSmall" style={[styles.statsValue, { color: theme.colors.primary }]}>
              {formatRupee(avgDailySpending)}
            </Text>
            <Text variant="bodySmall" style={styles.statsSubText}>this month</Text>
          </Card.Content>
        </Card>
        
        <Card style={[styles.statsCard, { flex: 1 }]}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.statsLabel}>Monthly Total</Text>
            <Text variant="headlineSmall" style={[styles.statsValue, { color: theme.colors.primary }]}>
              {formatRupee(totalThisMonth)}
            </Text>
            <Text variant="bodySmall" style={styles.statsSubText}>this month</Text>
          </Card.Content>
        </Card>
      </View>

      <Card style={[styles.card, { marginTop: 12, marginBottom: 16 }]}>
        <Card.Content style={styles.topCategoryContent}>
          <View>
            <Text variant="bodyMedium" style={{ color: 'gray' }}>Top Spending Category</Text>
            <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginTop: 4 }}>{topCategory}</Text>
          </View>
          {topCategoryTotal > 0 && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="bodySmall" style={{ color: 'gray' }}>Spent This Month</Text>
              <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.error, marginTop: 4 }}>
                {formatRupee(topCategoryTotal)}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Monthly Transactions Drawer/List */}
      <Card style={[styles.card, { marginBottom: 32 }]}>
        <List.Accordion
          title="Monthly Transactions"
          left={props => <List.Icon {...props} icon="receipt" />}
          style={{ backgroundColor: theme.colors.surface }}
        >
          {thisMonthExpenses.length === 0 ? (
            <List.Item title="No expenses recorded this month." />
          ) : (
            thisMonthExpenses.map((expense) => {
              const cat = categories.find(c => c.name === expense.category);
              const catColor = cat ? cat.color : theme.colors.primary;
              const catIcon = cat ? cat.icon : 'tag';
              return (
                <React.Fragment key={expense.id}>
                  <List.Item
                    title={expense.category}
                    description={`${format(parseISO(expense.date), 'MMM dd')} - ${expense.description || 'No description'}`}
                    left={props => <List.Icon {...props} icon={catIcon} color={catColor} />}
                    right={props => (
                      <Text {...props} style={styles.listAmount}>
                        -{formatRupee(expense.amount)}
                      </Text>
                    )}
                  />
                  <Divider />
                </React.Fragment>
              );
            })
          )}
        </List.Accordion>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 8 },
  monthPagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  monthLabel: {
    fontWeight: 'bold',
  },
  selectorContainer: { marginHorizontal: 8, marginBottom: 8 },
  card: { marginHorizontal: 8, overflow: 'hidden' },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  yAxisLabel: {
    position: 'absolute',
    left: 0,
    fontSize: 9,
    color: 'gray',
    textAlign: 'left',
  },
  xAxisLabel: {
    position: 'absolute',
    bottom: 0,
    fontSize: 9,
    color: 'gray',
    textAlign: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  sectionTitle: {
    marginHorizontal: 8,
    marginTop: 16,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 8,
    marginTop: 4,
  },
  statsCard: {
    borderRadius: 12,
  },
  statsLabel: {
    color: 'gray',
  },
  statsValue: {
    fontWeight: 'bold',
    marginTop: 4,
  },
  statsSubText: {
    color: 'gray',
    fontSize: 10,
    marginTop: 2,
  },
  topCategoryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listAmount: {
    alignSelf: 'center',
    fontWeight: 'bold',
    fontSize: 14,
    marginRight: 16,
    color: '#e74c3c'
  }
});
