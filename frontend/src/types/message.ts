export interface FilterOption {
  column: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in';
  value: string | number | string[] | [number, number];
}

export interface DashboardLayout {
  id: string;
  name: string;
  visuals: DashboardVisual[];
  layout: GridLayoutItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardVisual extends PinnedVisual {
  layout: GridLayoutItem;
  filters?: FilterOption[];
  filteredData?: any[];
}

export interface GridLayoutItem {
  i: string; // visual id
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  sqlQuery?: string;
  queryResult?: string;
  isError?: boolean;
  // New analytics fields
  analyticsData?: AnalyticsData;
}

export interface ChartConfig {
  title: string;
  description: string;
  color_scheme: string;
}

export interface VisualRecommendation {
  visual_type: string;
  x_axis: string | null;
  y_axis: string | string[] | null;
  group_by: string[] | null;
  chart_config: ChartConfig;
}

export interface AnalyticsData {
  user_prompt: string;
  sql_query_generated: string;
  output_result: any[];
  chart_type: string;
  notes: string;
  possible_filters: string[];
  // New format fields
  visual_recommendation?: VisualRecommendation;
  insights_summary?: string;
}

export interface PinnedVisual {
  id: string;
  title: string;
  chartType: string;
  data: any[];
  notes: string;
  possibleFilters: string[];
  timestamp: Date;
  visual_recommendation?: VisualRecommendation;
}

export interface ChatRequest {
  query: string;
  session_id?: string;
}

export interface ChatResponse {
  success: boolean;
  user_query: string;
  sql_query: string;
  query_result: string;
  response: string;
  error?: string;
}

export interface AnalyticsResponse {
  success: boolean;
  user_prompt: string;
  sql_query_generated: string;
  output_result: any[];
  chart_type: string;
  notes: string;
  possible_filters: string[];
  error?: string;
}

export interface SessionResponse {
  session_id: string;
  message: string;
  success: boolean;
}
