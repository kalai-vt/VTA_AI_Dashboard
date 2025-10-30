import React, { useState, useMemo, useEffect } from 'react';
import { AnalyticsData, FilterOption } from '../types/message';
import AutoVisualRenderer from './AutoVisualRenderer';
import FilterModal from './FilterModal';
import { applyFilters } from '../utils/filterUtils';

interface ChartComponentProps {
  data: AnalyticsData;
  onPinToDashboard?: (data: AnalyticsData) => void;
  onRemove?: () => void;
  isPinned?: boolean;
  filters?: FilterOption[];
  onFiltersChange?: (filters: FilterOption[]) => void;
}

const ChartComponent: React.FC<ChartComponentProps> = ({ 
  data, 
  onPinToDashboard, 
  onRemove, 
  isPinned = false,
  filters = [],
  onFiltersChange
}) => {
  const { chart_type, output_result, notes, possible_filters, visual_recommendation, insights_summary } = data;
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterOption[]>(filters);

  // Sync filters from props
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Get columns from data
  const columns = useMemo(() => {
    if (!output_result || output_result.length === 0) return [];
    return Object.keys(output_result[0]);
  }, [output_result]);

  // Apply filters to data
  const filteredData = useMemo(() => {
    if (!localFilters || localFilters.length === 0) return output_result;
    return applyFilters(output_result, localFilters);
  }, [output_result, localFilters]);

  // Create filtered analytics data
  const filteredAnalyticsData: AnalyticsData = {
    ...data,
    output_result: filteredData
  };

  const handleApplyFilters = (newFilters: FilterOption[]) => {
    setLocalFilters(newFilters);
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
  };

  // Always use AutoVisualRenderer - create default visual_recommendation if missing
  const getVisualRecommendation = () => {
    if (visual_recommendation) {
      return visual_recommendation;
    }
    
    // Create default visual_recommendation based on chart_type and data
    const columns = filteredData && filteredData.length > 0 ? Object.keys(filteredData[0]) : [];
    const numericCols = columns.filter(col => {
      const sampleValue = filteredData?.[0]?.[col];
      return typeof sampleValue === 'number' || !isNaN(Number(sampleValue));
    });
    const categoricalCols = columns.filter(col => !numericCols.includes(col));
    
    const xAxis = categoricalCols[0] || columns[0] || null;
    const yAxis = numericCols[0] || columns[1] || null;
    
    // Determine visual type from chart_type
    let visualType = 'table';
    if (chart_type) {
      const ct = chart_type.toLowerCase();
      if (ct.includes('line')) visualType = 'line';
      else if (ct.includes('bar')) visualType = 'bar';
      else if (ct.includes('pie')) visualType = 'pie';
      else if (ct.includes('scatter')) visualType = 'scatter';
      else if (ct.includes('area')) visualType = 'area';
    }
    
    return {
      visual_type: visualType,
      x_axis: xAxis,
      y_axis: yAxis,
      group_by: null,
      chart_config: {
        title: data.user_prompt || `${chart_type} Chart` || 'Chart',
        description: notes || insights_summary || 'Data visualization',
        color_scheme: 'auto'
      }
    };
  };

  return (
    <div className="vta-chart-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="vta-chart-header-actions">
        {isPinned && (
          <button
            onClick={() => setShowFilterModal(true)}
            className="vta-filter-button"
            title="Apply Filters"
          >
            🔍 Filter {localFilters.length > 0 && `(${localFilters.length})`}
          </button>
        )}
        {isPinned && onRemove && (
          <button
            onClick={onRemove}
            className="vta-remove-button"
            title="Remove from Dashboard"
          >
            ❌ Remove
          </button>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AutoVisualRenderer 
          visualData={{
            user_query: data.user_prompt,
            query_result: filteredData || [],
            visual_recommendation: getVisualRecommendation(),
            insights_summary: insights_summary || notes
          }}
          hideInsights={isPinned}
        />
      </div>
      {!isPinned && onPinToDashboard && (
        <button
          onClick={() => onPinToDashboard(data)}
          className="vta-pin-button"
          style={{ marginTop: '1rem' }}
        >
          📌 Pin to Dashboard
        </button>
      )}
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={handleApplyFilters}
        columns={columns}
        data={output_result}
        currentFilters={localFilters}
      />
    </div>
  );
};

export default ChartComponent;

