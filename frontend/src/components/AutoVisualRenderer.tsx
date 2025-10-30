import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ComposedChart
} from 'recharts';

interface VisualRecommendation {
  visual_type: string;
  x_axis: string | null;
  y_axis: string | string[] | null;
  group_by: string[] | null;
  chart_config: {
    title: string;
    description: string;
    color_scheme: string;
  };
}

interface AutoVisualRendererProps {
  visualData: {
    user_query?: string;
    query_result: any[];
    visual_recommendation: VisualRecommendation;
    insights_summary?: string;
  };
  hideInsights?: boolean;
  containerHeight?: number; // Optional container height for auto-sizing
}

// Color palette for charts
const CHART_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

const AutoVisualRenderer: React.FC<AutoVisualRendererProps> = ({ visualData, hideInsights = false, containerHeight }) => {
  const { query_result: data, visual_recommendation, insights_summary } = visualData;
  const { visual_type, x_axis, y_axis, chart_config } = visual_recommendation;
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(450);
  
  // Calculate chart height dynamically based on container
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        // Subtract space for title, margins, and summary
        const headerHeight = chart_config.title ? 80 : 0;
        const summaryHeight = hideInsights && insights_summary ? 40 : (!hideInsights && insights_summary ? 100 : 0);
        const calculatedHeight = Math.max(containerRect.height - headerHeight - summaryHeight - 40, 300);
        setChartHeight(calculatedHeight);
      }
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [chart_config.title, insights_summary, hideInsights]);

  if (!data || data.length === 0) {
    return (
      <div className="vta-chart-placeholder">
        <div className="vta-text-center" style={{ padding: '2rem', color: '#6b7280' }}>
          📊 No data available for visualization
        </div>
      </div>
    );
  }

  // Helper to check if value is numeric
  const isNumeric = (val: any): boolean => {
    return !isNaN(parseFloat(val)) && isFinite(val);
  };

  // Get numeric columns
  const getNumericColumns = (): string[] => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]).filter(key => 
      data.some(row => isNumeric(row[key]))
    );
  };

  // Get categorical columns
  const getCategoricalColumns = (): string[] => {
    if (!data || data.length === 0) return [];
    const numericCols = getNumericColumns();
    return Object.keys(data[0]).filter(key => !numericCols.includes(key));
  };

  // Prepare chart data
  const prepareChartData = () => {
    return data.map(row => {
      const processed: any = {};
      Object.keys(row).forEach(key => {
        const val = row[key];
        // Convert numeric strings to numbers
        if (typeof val === 'string' && isNumeric(val)) {
          processed[key] = parseFloat(val);
        } else {
          processed[key] = val;
        }
      });
      return processed;
    });
  };

  const chartData = prepareChartData();

  // Render based on visual type
  const renderVisual = () => {
    switch (visual_type.toLowerCase()) {
      case 'kpi_card':
        return renderKPICard();
      case 'card':
        return renderCard();
      case 'bar':
        return renderBarChart();
      case 'line':
        return renderLineChart();
      case 'pie':
        return renderPieChart();
      case 'donut':
        return renderDonutChart();
      case 'area':
        return renderAreaChart();
      case 'scatter':
        return renderScatterChart();
      case 'combo':
        return renderComboChart();
      case 'funnel':
        return renderFunnelChart();
      case 'geo_map':
        return renderGeoMap();
      case 'heatmap':
        return renderHeatmap();
      case 'table':
      default:
        return renderTable();
    }
  };

  const renderKPICard = () => {
    const yAxisStr = Array.isArray(y_axis) ? y_axis[0] : y_axis;
    if (!yAxisStr || !chartData[0]) return renderTable();
    
    const value = chartData[0][yAxisStr];
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#3b82f6' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div style={{ fontSize: '1.25rem', color: '#6b7280', marginTop: '0.5rem' }}>
          {chart_config.title || yAxisStr.replace(/_/g, ' ').toUpperCase()}
        </div>
      </div>
    );
  };

  const renderCard = () => {
    // Render a card for single entity lookup queries
    // If no data or very minimal data, show insights summary prominently
    if (!chartData || chartData.length === 0) {
      if (insights_summary) {
        return (
          <div style={{ 
            padding: '0.75rem', 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'stretch'
          }}>
            <div style={{ 
              backgroundColor: '#f9fafc', 
              borderRadius: '10px', 
              padding: '1rem',
              border: '1px solid #e5e7eb',
              textAlign: 'center',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
                💡 Summary
              </div>
              <div style={{ fontSize: '0.9rem', color: '#4b5563', lineHeight: '1.5', wordBreak: 'break-word' }}>
                {insights_summary}
              </div>
            </div>
          </div>
        );
      }
      return renderTable();
    }
    
    const record = chartData[0];
    const columns = Object.keys(record).filter(key => record[key] !== null && record[key] !== undefined);
    
    // If no valid columns or if insights_summary is more meaningful, show summary
    if (columns.length === 0 || (insights_summary && columns.length <= 2)) {
      return (
        <div style={{ 
          padding: '0.75rem', 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ 
            backgroundColor: '#f9fafc', 
            borderRadius: '10px', 
            padding: '1rem',
            border: '1px solid #e5e7eb',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
              💡 Summary
            </div>
            <div style={{ fontSize: '0.9rem', color: '#4b5563', lineHeight: '1.5', wordBreak: 'break-word' }}>
              {insights_summary || 'No additional information available.'}
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div style={{ padding: '0.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ 
          backgroundColor: '#f9fafc', 
          borderRadius: '10px', 
          padding: '0.75rem',
          border: '1px solid #e5e7eb',
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {insights_summary ? (
            // Show insights summary prominently at the top
            <div style={{ 
              marginBottom: '0.75rem',
              padding: '0.75rem',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827', marginBottom: '0.375rem' }}>
                💡 Summary
              </div>
              <div style={{ fontSize: '0.8rem', color: '#4b5563', lineHeight: '1.4', wordBreak: 'break-word' }}>
                {insights_summary}
              </div>
            </div>
          ) : (
            // Show title if no insights summary
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: '700', 
              marginBottom: '0.75rem',
              marginTop: 0,
              color: '#111827',
              textAlign: 'left'
            }}>
              {chart_config.title || 'Record Details'}
            </h3>
          )}
          
          {columns.length > 0 && (
            <div style={{ display: 'grid', gap: '0.5rem', flex: 1 }}>
              {columns.map((key, index) => {
                const value = record[key];
                if (value === null || value === undefined) return null;
                
                const formattedKey = key
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, l => l.toUpperCase())
                  .trim();
                
                return (
                  <div 
                    key={index}
                    style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      paddingBottom: '0.5rem',
                      borderBottom: index < columns.length - 1 ? '1px solid #e5e7eb' : 'none'
                    }}
                  >
                    <span style={{ fontWeight: '600', color: '#6b7280', minWidth: '120px', flexShrink: 0, fontSize: '0.85rem' }}>
                      {formattedKey}:
                    </span>
                    <span style={{ color: '#111827', textAlign: 'right', flex: 1, wordBreak: 'break-word', fontSize: '0.85rem' }}>
                      {typeof value === 'number' ? value.toLocaleString() : String(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderBarChart = () => {
    const xAxisKey = x_axis || getCategoricalColumns()[0];
    const yAxisKey = Array.isArray(y_axis) ? y_axis[0] : (y_axis || getNumericColumns()[0]);
    
    if (!xAxisKey || !yAxisKey) return renderTable();

    // Format axis labels
    const formatAxisLabel = (label: string) => {
      return label
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
    };

    const xAxisLabel = formatAxisLabel(xAxisKey);
    const yAxisLabel = formatAxisLabel(yAxisKey);

    // Sort data by value descending for better visualization
    const sortedData = [...chartData].sort((a, b) => {
      const aVal = parseFloat(a[yAxisKey]) || 0;
      const bVal = parseFloat(b[yAxisKey]) || 0;
      return bVal - aVal;
    });

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart 
          data={sortedData}
          margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey={xAxisKey} 
            label={{ value: xAxisLabel, position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
            interval={0}
          />
          <YAxis 
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
            tick={{ fontSize: 12 }}
            width={80}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '4px' }}
            formatter={(value: any) => [typeof value === 'number' ? value.toLocaleString() : value, yAxisLabel]}
            labelFormatter={(label) => `${xAxisLabel}: ${label}`}
          />
          <Legend 
            verticalAlign="top" 
            height={36}
            wrapperStyle={{ paddingBottom: '10px' }}
          />
          <Bar 
            dataKey={yAxisKey} 
            name={yAxisLabel}
            fill={CHART_COLORS[0]}
            radius={[4, 4, 0, 0]}
            animationDuration={1000}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderLineChart = () => {
    let xAxisKey = x_axis || getCategoricalColumns()[0];
    let yAxisKey = Array.isArray(y_axis) ? y_axis[0] : (y_axis || getNumericColumns()[0]);
    
    // Fallback: if still no axes detected, use first two columns
    if (!xAxisKey || !yAxisKey) {
      const allColumns = Object.keys(chartData[0] || {});
      if (allColumns.length >= 2) {
        xAxisKey = xAxisKey || allColumns[0];
        yAxisKey = yAxisKey || allColumns[1];
      } else {
        return renderTable();
      }
    }
    
    if (!xAxisKey || !yAxisKey) return renderTable();

    // Format axis labels
    const formatAxisLabel = (label: string) => {
      return label
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
    };

    const xAxisLabel = formatAxisLabel(xAxisKey);
    const yAxisLabel = formatAxisLabel(yAxisKey);

    // Sort data by x-axis for better trend visualization
    const sortedData = [...chartData].sort((a, b) => {
      const aVal = a[xAxisKey];
      const bVal = b[xAxisKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return aVal - bVal;
      }
      return String(aVal).localeCompare(String(bVal));
    });

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart 
          data={sortedData}
          margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey={xAxisKey} 
            label={{ value: xAxisLabel, position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
            interval={0}
          />
          <YAxis 
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
            tick={{ fontSize: 12 }}
            width={80}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '4px' }}
            formatter={(value: any) => [typeof value === 'number' ? value.toLocaleString() : value, yAxisLabel]}
            labelFormatter={(label) => `${xAxisLabel}: ${label}`}
          />
          <Legend 
            verticalAlign="top" 
            height={36}
            iconType="line"
            wrapperStyle={{ paddingBottom: '10px' }}
          />
          <Line 
            type="monotone" 
            dataKey={yAxisKey} 
            name={yAxisLabel}
            stroke={CHART_COLORS[0]} 
            strokeWidth={3}
            dot={{ r: 5, fill: CHART_COLORS[0], strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 7 }}
            connectNulls={false}
            animationDuration={1000}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderPieChart = () => {
    const xAxisKey = x_axis || getCategoricalColumns()[0];
    const yAxisKey = Array.isArray(y_axis) ? y_axis[0] : (y_axis || getNumericColumns()[0]);
    
    if (!xAxisKey || !yAxisKey) return renderTable();

    const pieData = chartData.slice(0, 10).map(row => ({
      name: String(row[xAxisKey]),
      value: parseFloat(row[yAxisKey]) || 0
    }));

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderDonutChart = () => {
    const xAxisKey = x_axis || getCategoricalColumns()[0];
    const yAxisKey = Array.isArray(y_axis) ? y_axis[0] : (y_axis || getNumericColumns()[0]);
    
    if (!xAxisKey || !yAxisKey) return renderTable();

    const pieData = chartData.slice(0, 10).map(row => ({
      name: String(row[xAxisKey]),
      value: parseFloat(row[yAxisKey]) || 0
    }));

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            innerRadius={60}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderAreaChart = () => {
    const xAxisKey = x_axis || getCategoricalColumns()[0];
    const yAxisKey = Array.isArray(y_axis) ? y_axis[0] : (y_axis || getNumericColumns()[0]);
    
    if (!xAxisKey || !yAxisKey) return renderTable();

    // Format axis labels
    const formatAxisLabel = (label: string) => {
      return label
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
    };

    const xAxisLabel = formatAxisLabel(xAxisKey);
    const yAxisLabel = formatAxisLabel(yAxisKey);

    // Sort data by x-axis
    const sortedData = [...chartData].sort((a, b) => {
      const aVal = a[xAxisKey];
      const bVal = b[xAxisKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return aVal - bVal;
      }
      return String(aVal).localeCompare(String(bVal));
    });

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart 
          data={sortedData}
          margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey={xAxisKey} 
            label={{ value: xAxisLabel, position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
            interval={0}
          />
          <YAxis 
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
            tick={{ fontSize: 12 }}
            width={80}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '4px' }}
            formatter={(value: any) => [typeof value === 'number' ? value.toLocaleString() : value, yAxisLabel]}
            labelFormatter={(label) => `${xAxisLabel}: ${label}`}
          />
          <Legend 
            verticalAlign="top" 
            height={36}
            wrapperStyle={{ paddingBottom: '10px' }}
          />
          <Area 
            type="monotone" 
            dataKey={yAxisKey} 
            name={yAxisLabel}
            stroke={CHART_COLORS[0]} 
            fill={CHART_COLORS[0]}
            fillOpacity={0.6}
            strokeWidth={2}
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  const renderScatterChart = () => {
    const numericCols = getNumericColumns();
    const xAxisKey = x_axis || numericCols[0];
    const yAxisKey = Array.isArray(y_axis) ? y_axis[1] : (y_axis || numericCols[1]);
    
    if (!xAxisKey || !yAxisKey) return renderTable();

    // Format axis labels
    const formatAxisLabel = (label: string) => {
      return label
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
    };

    const xAxisLabel = formatAxisLabel(xAxisKey);
    const yAxisLabel = formatAxisLabel(yAxisKey);

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ScatterChart 
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            type="number" 
            dataKey={xAxisKey} 
            label={{ value: xAxisLabel, position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            type="number" 
            dataKey={yAxisKey} 
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
            tick={{ fontSize: 12 }}
            width={80}
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '4px' }}
          />
          <Legend 
            verticalAlign="top" 
            height={36}
            wrapperStyle={{ paddingBottom: '10px' }}
          />
          <Scatter 
            dataKey={yAxisKey} 
            name={yAxisLabel}
            fill={CHART_COLORS[0]}
            fillOpacity={0.7}
          />
        </ScatterChart>
      </ResponsiveContainer>
    );
  };

  const renderComboChart = () => {
    const xAxisKey = x_axis || getCategoricalColumns()[0];
    const yAxes = Array.isArray(y_axis) ? y_axis : (y_axis ? [y_axis] : getNumericColumns());
    
    if (!xAxisKey || yAxes.length === 0) return renderTable();

    // Format axis labels
    const formatAxisLabel = (label: string) => {
      return label
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
    };

    const xAxisLabel = formatAxisLabel(xAxisKey);
    const yAxisLabel1 = formatAxisLabel(yAxes[0] || '');
    const yAxisLabel2 = yAxes[1] ? formatAxisLabel(yAxes[1]) : '';

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart 
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey={xAxisKey} 
            label={{ value: xAxisLabel, position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
            interval={0}
          />
          <YAxis 
            yAxisId="left" 
            label={{ value: yAxisLabel1, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
            tick={{ fontSize: 12 }}
            width={80}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right"
            label={{ value: yAxisLabel2 || 'Value', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
            tick={{ fontSize: 12 }}
            width={80}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '4px' }}
            formatter={(value: any, name: string) => [typeof value === 'number' ? value.toLocaleString() : value, name]}
            labelFormatter={(label) => `${xAxisLabel}: ${label}`}
          />
          <Legend 
            verticalAlign="top" 
            height={36}
            wrapperStyle={{ paddingBottom: '10px' }}
          />
          <Bar 
            yAxisId="left" 
            dataKey={yAxes[0]} 
            name={yAxisLabel1}
            fill={CHART_COLORS[0]}
            radius={[4, 4, 0, 0]}
            animationDuration={1000}
          />
          {yAxes[1] && (
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey={yAxes[1]} 
              name={yAxisLabel2}
              stroke={CHART_COLORS[1]} 
              strokeWidth={3}
              dot={{ r: 5, fill: CHART_COLORS[1], strokeWidth: 2, stroke: '#fff' }}
              animationDuration={1000}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  const renderFunnelChart = () => {
    const xAxisKey = x_axis || getCategoricalColumns()[0];
    const yAxisKey = Array.isArray(y_axis) ? y_axis[0] : (y_axis || getNumericColumns()[0]);
    
    if (!xAxisKey || !yAxisKey) return renderTable();

    // Sort data by value descending for funnel effect
    const sortedData = [...chartData].sort((a, b) => 
      (parseFloat(b[yAxisKey]) || 0) - (parseFloat(a[yAxisKey]) || 0)
    );

    const maxValue = Math.max(...sortedData.map(d => parseFloat(d[yAxisKey]) || 0));

    return (
      <div style={{ padding: '2rem' }}>
        {sortedData.map((row, index) => {
          const value = parseFloat(row[yAxisKey]) || 0;
          const widthPercent = (value / maxValue) * 100;
          const color = CHART_COLORS[index % CHART_COLORS.length];
          
          return (
            <div key={index} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ minWidth: '150px', fontWeight: 'bold' }}>
                  {row[xAxisKey]}
                </div>
                <div style={{ marginLeft: '1rem', color: '#6b7280' }}>
                  {value.toLocaleString()}
                </div>
              </div>
              <div 
                style={{ 
                  width: '100%', 
                  height: '40px', 
                  backgroundColor: '#e5e7eb',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}
              >
                <div 
                  style={{ 
                    width: `${widthPercent}%`, 
                    height: '100%', 
                    backgroundColor: color,
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderGeoMap = () => {
    // Placeholder for geo map - would integrate with react-map-gl or similar
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        🗺️ Geographic map visualization
        <br />
        <small>Geo map integration coming soon</small>
      </div>
    );
  };

  const renderHeatmap = () => {
    // Simple heatmap using table with color coding
    const categoricalCols = getCategoricalColumns();
    const numericCols = getNumericColumns();
    
    if (categoricalCols.length < 2 || numericCols.length < 1) return renderTable();

    const xCol = categoricalCols[0];
    const yCol = categoricalCols[1];
    const valCol = numericCols[0];

    // Group data
    const heatmapData: any = {};
    let maxVal = 0;
    
    chartData.forEach(row => {
      const x = String(row[xCol]);
      const y = String(row[yCol]);
      const val = parseFloat(row[valCol]) || 0;
      
      if (!heatmapData[x]) heatmapData[x] = {};
      heatmapData[x][y] = val;
      maxVal = Math.max(maxVal, val);
    });

    const xValues = Object.keys(heatmapData);
    const yValues = new Set<string>();
    xValues.forEach(x => Object.keys(heatmapData[x]).forEach(y => yValues.add(y)));

    const getColorIntensity = (val: number) => {
      const intensity = maxVal > 0 ? val / maxVal : 0;
      const alpha = 0.3 + (intensity * 0.7);
      return `rgba(59, 130, 246, ${alpha})`;
    };

    return (
      <div style={{ padding: '1rem', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.5rem', border: '1px solid #e5e7eb' }}></th>
              {Array.from(yValues).map(y => (
                <th key={y} style={{ padding: '0.5rem', border: '1px solid #e5e7eb' }}>
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {xValues.map(x => (
              <tr key={x}>
                <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb', fontWeight: 'bold' }}>
                  {x}
                </td>
                {Array.from(yValues).map(y => {
                  const val = heatmapData[x][y] || 0;
                  return (
                    <td 
                      key={y} 
                      style={{ 
                        padding: '0.5rem', 
                        border: '1px solid #e5e7eb',
                        backgroundColor: getColorIntensity(val),
                        textAlign: 'center'
                      }}
                    >
                      {val.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTable = () => {
    if (!data || data.length === 0) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          No data available
        </div>
      );
    }

    const columns = Object.keys(data[0]);

    return (
      <div style={{ overflow: 'auto', maxHeight: '400px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              {columns.map(col => (
                <th 
                  key={col} 
                  style={{ 
                    padding: '0.75rem', 
                    textAlign: 'left', 
                    borderBottom: '2px solid #e5e7eb',
                    fontWeight: 'bold'
                  }}
                >
                  {col.replace(/_/g, ' ').toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                {columns.map(col => (
                  <td key={col} style={{ padding: '0.75rem' }}>
                    {row[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="vta-auto-visual-renderer" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {chart_config.title && (
        <div style={{ marginBottom: '0.375rem', flexShrink: 0, padding: '0 0.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.125rem', marginTop: 0, textAlign: 'left', color: '#111827' }}>
            {chart_config.title}
          </h3>
          {chart_config.description && (
            <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0, lineHeight: '1.3' }}>
              {chart_config.description}
            </p>
          )}
        </div>
      )}
      <div className="vta-chart-container" ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {renderVisual()}
      </div>
      {!hideInsights && insights_summary && (
        <div style={{ marginTop: 'auto', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem', flexShrink: 0 }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>💡 Insights:</div>
          <div style={{ color: '#4b5563' }}>{insights_summary}</div>
        </div>
      )}
      {hideInsights && insights_summary && (
        <div style={{ 
          marginTop: 'auto', 
          padding: '0.5rem 0.75rem', 
          backgroundColor: '#f9fafc', 
          borderRadius: '0 0 10px 10px',
          borderTop: '1px solid #e5e7eb',
          fontSize: '0.75rem',
          color: '#6b7280',
          flexShrink: 0,
          whiteSpace: 'normal',
          overflow: 'visible',
          wordBreak: 'break-word',
          lineHeight: '1.4'
        }} title={insights_summary}>
          💡 {insights_summary}
        </div>
      )}
    </div>
  );
};

export default AutoVisualRenderer;

