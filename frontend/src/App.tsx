import React, { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import ChatWindow from './ChatWindow';
import ChartComponent from './components/ChartComponent';
import DashboardManager from './components/DashboardManager';
import { PinnedVisual, AnalyticsData, DashboardLayout, DashboardVisual, GridLayoutItem, FilterOption } from './types/message';
import { exportDashboardToPDF } from './utils/pdfExport';
import { applyFilters } from './utils/filterUtils';
import './index.css';
import './components/dashboardStyles.css';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

function App() {
  const [pinnedVisuals, setPinnedVisuals] = useState<DashboardVisual[]>([]);
  const [dashboards, setDashboards] = useState<DashboardLayout[]>([]);
  const [currentDashboardId, setCurrentDashboardId] = useState<string | null>(null);
  const [layout, setLayout] = useState<GridLayoutItem[]>([]);

  // Load dashboards from localStorage
  useEffect(() => {
    const loadDashboards = () => {
      const savedDashboards = localStorage.getItem('vta-dashboards');
      if (savedDashboards) {
        try {
          const parsed = JSON.parse(savedDashboards);
          const dashboardsWithDates = parsed.map((d: any) => ({
            ...d,
            createdAt: new Date(d.createdAt),
            updatedAt: new Date(d.updatedAt),
            visuals: d.visuals.map((v: any) => ({
              ...v,
              timestamp: new Date(v.timestamp)
            }))
          }));
          setDashboards(dashboardsWithDates);
          
          // Load last used dashboard or first dashboard
          const lastDashboardId = localStorage.getItem('vta-current-dashboard');
          if (lastDashboardId && dashboardsWithDates.find((d: DashboardLayout) => d.id === lastDashboardId)) {
            setCurrentDashboardId(lastDashboardId);
            const dashboard = dashboardsWithDates.find((d: DashboardLayout) => d.id === lastDashboardId);
            if (dashboard) {
              setPinnedVisuals(dashboard.visuals);
              // Ensure all layout items have string IDs
              const normalizedLayout = dashboard.layout.map(l => ({
                ...l,
                i: l.i.toString()
              }));
              setLayout(normalizedLayout);
            }
          } else if (dashboardsWithDates.length > 0) {
            setCurrentDashboardId(dashboardsWithDates[0].id);
            setPinnedVisuals(dashboardsWithDates[0].visuals);
            // Ensure all layout items have string IDs
            const normalizedLayout = dashboardsWithDates[0].layout.map((l: any) => ({
              ...l,
              i: l.i.toString()
            }));
            setLayout(normalizedLayout);
          }
        } catch (error) {
          console.error('Error loading dashboards:', error);
        }
      }
    };
    
    loadDashboards();
    
    // Load legacy pinned visuals if no dashboard exists
    if (!localStorage.getItem('vta-dashboards')) {
      const savedVisuals = localStorage.getItem('vta-pinned-visuals');
      if (savedVisuals) {
        try {
          const parsed = JSON.parse(savedVisuals);
          const visualsWithDates = parsed.map((visual: any, index: number) => ({
            ...visual,
            timestamp: new Date(visual.timestamp),
            layout: {
              i: visual.id.toString(),
              x: (index % 3) * 4,
              y: Math.floor(index / 3) * 4,
              w: 4,
              h: 4,
              minW: 3,
              minH: 3,
              maxW: 12,
              maxH: 16
            }
          }));
          setPinnedVisuals(visualsWithDates);
          setLayout(visualsWithDates.map(v => v.layout));
        } catch (error) {
          console.error('Error loading pinned visuals:', error);
        }
      }
    }
  }, []);

  // Save current dashboard state
  useEffect(() => {
    if (currentDashboardId && pinnedVisuals.length > 0) {
      saveCurrentDashboard();
    }
  }, [pinnedVisuals, layout, currentDashboardId]);

  const loadDashboard = (dashboardId: string) => {
    const dashboard = dashboards.find(d => d.id === dashboardId);
    if (dashboard) {
      setPinnedVisuals(dashboard.visuals);
      // Ensure all layout items have string IDs
      const normalizedLayout = dashboard.layout.map(l => ({
        ...l,
        i: l.i.toString()
      }));
      setLayout(normalizedLayout);
      localStorage.setItem('vta-current-dashboard', dashboardId);
    }
  };

  const saveCurrentDashboard = () => {
    if (!currentDashboardId) return;
    
    const updatedDashboards = dashboards.map(d => 
      d.id === currentDashboardId
        ? {
            ...d,
            visuals: pinnedVisuals,
            layout: layout,
            updatedAt: new Date()
          }
        : d
    );
    
    setDashboards(updatedDashboards);
    localStorage.setItem('vta-dashboards', JSON.stringify(updatedDashboards));
  };

  const handlePinVisual = (visual: PinnedVisual) => {
    // Calculate optimal grid position - prevent overlaps
    const cols = 12;
    const itemWidth = 4; // Compact default width
    const itemHeight = 6; // Compact default height
    
    // Find next available position using compact algorithm
    let maxY = 0;
    const occupiedPositions = new Set<string>();
    
    layout.forEach(l => {
      maxY = Math.max(maxY, (l.y || 0) + (l.h || itemHeight));
      // Mark all occupied grid cells
      for (let y = l.y || 0; y < (l.y || 0) + (l.h || itemHeight); y++) {
        for (let x = l.x || 0; x < (l.x || 0) + (l.w || itemWidth); x++) {
          occupiedPositions.add(`${x},${y}`);
        }
      }
    });
    
    // Try to find an empty position
    let placedX = 0;
    let placedY = 0;
    let foundPosition = false;
    
    // First try to place in existing rows
    for (let y = 0; y <= maxY && !foundPosition; y++) {
      for (let x = 0; x <= cols - itemWidth && !foundPosition; x++) {
        // Check if this position and size is available
        let canPlace = true;
        for (let checkY = y; checkY < y + itemHeight && canPlace; checkY++) {
          for (let checkX = x; checkX < x + itemWidth && canPlace; checkX++) {
            if (occupiedPositions.has(`${checkX},${checkY}`)) {
              canPlace = false;
            }
          }
        }
        
        if (canPlace) {
          placedX = x;
          placedY = y;
          foundPosition = true;
        }
      }
    }
    
    // If no position found, place at the bottom
    if (!foundPosition) {
      placedY = maxY;
    }
    
    const dashboardVisual: DashboardVisual = {
      ...visual,
      layout: {
        i: visual.id.toString(), // Ensure it's a string
        x: placedX,
        y: placedY,
        w: itemWidth,
        h: itemHeight,
        minW: 3,
        minH: 3,
        maxW: 12,
        maxH: 16
      },
      filters: [],
      filteredData: visual.data
    };
    
    setPinnedVisuals(prev => [...prev, dashboardVisual]);
    setLayout(prev => [...prev, dashboardVisual.layout]);
    
    // If no dashboard exists, create a default one
    if (!currentDashboardId) {
      const defaultDashboard: DashboardLayout = {
        id: `dashboard-${Date.now()}`,
        name: 'My Dashboard',
        visuals: [dashboardVisual],
        layout: [dashboardVisual.layout],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setDashboards([defaultDashboard]);
      setCurrentDashboardId(defaultDashboard.id);
      localStorage.setItem('vta-dashboards', JSON.stringify([defaultDashboard]));
      localStorage.setItem('vta-current-dashboard', defaultDashboard.id);
    }
  };

  const handleRemoveVisual = (visualId: string) => {
    setPinnedVisuals(prev => prev.filter(v => v.id.toString() !== visualId.toString()));
    setLayout(prev => prev.filter(l => l.i.toString() !== visualId.toString()));
  };

  const handleLayoutChange = (newLayout: GridLayoutItem[]) => {
    // Ensure all IDs are strings and validate layout
    const validatedLayout = newLayout.map(item => ({
      ...item,
      i: item.i.toString()
    }));
    
    setLayout(validatedLayout);
    // Update visual layouts
    setPinnedVisuals(prev => prev.map(v => {
      const updatedLayout = validatedLayout.find(l => l.i === v.id.toString());
      return updatedLayout ? { ...v, layout: updatedLayout } : v;
    }));
    
    // Save to current dashboard
    if (currentDashboardId) {
      const updatedDashboards = dashboards.map(d => 
        d.id === currentDashboardId 
          ? { ...d, layout: validatedLayout, updatedAt: new Date() }
          : d
      );
      setDashboards(updatedDashboards);
      localStorage.setItem('vta-dashboards', JSON.stringify(updatedDashboards));
    }
  };

  const handleFiltersChange = (visualId: string, filters: FilterOption[]) => {
    setPinnedVisuals(prev => prev.map(v => {
      if (v.id.toString() === visualId.toString()) {
        // Apply filters to get filtered data
        const filteredData = applyFilters(v.data, filters);
        return { ...v, filters, filteredData };
      }
      return v;
    }));
  };

  const handleSaveDashboard = (name: string) => {
    const newDashboard: DashboardLayout = {
      id: `dashboard-${Date.now()}`,
      name,
      visuals: pinnedVisuals,
      layout: layout,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const updatedDashboards = [...dashboards, newDashboard];
    setDashboards(updatedDashboards);
    setCurrentDashboardId(newDashboard.id);
    localStorage.setItem('vta-dashboards', JSON.stringify(updatedDashboards));
    localStorage.setItem('vta-current-dashboard', newDashboard.id);
  };

  const handleDeleteDashboard = (dashboardId: string) => {
    if (confirm('Are you sure you want to delete this dashboard?')) {
      const updatedDashboards = dashboards.filter(d => d.id !== dashboardId);
      setDashboards(updatedDashboards);
      
      if (currentDashboardId === dashboardId) {
        if (updatedDashboards.length > 0) {
          setCurrentDashboardId(updatedDashboards[0].id);
          loadDashboard(updatedDashboards[0].id);
        } else {
          setCurrentDashboardId(null);
          setPinnedVisuals([]);
          setLayout([]);
        }
      }
      
      localStorage.setItem('vta-dashboards', JSON.stringify(updatedDashboards));
    }
  };

  const handleRenameDashboard = (dashboardId: string, newName: string) => {
    const updatedDashboards = dashboards.map(d => 
      d.id === dashboardId ? { ...d, name: newName, updatedAt: new Date() } : d
    );
    setDashboards(updatedDashboards);
    localStorage.setItem('vta-dashboards', JSON.stringify(updatedDashboards));
  };

  const handleSelectDashboard = (dashboardId: string) => {
    setCurrentDashboardId(dashboardId);
    loadDashboard(dashboardId);
  };

  const handleExportPDF = () => {
    const dashboardElement = document.getElementById('dashboard-grid');
    if (dashboardElement) {
      const dashboardName = dashboards.find(d => d.id === currentDashboardId)?.name || 'Dashboard';
      exportDashboardToPDF(dashboardElement, dashboardName);
    }
  };

  const convertToAnalyticsData = (visual: DashboardVisual): AnalyticsData => ({
    user_prompt: visual.title,
    sql_query_generated: '',
    output_result: visual.filteredData || visual.data,
    chart_type: visual.chartType,
    notes: visual.notes,
    possible_filters: visual.possibleFilters,
    visual_recommendation: visual.visual_recommendation,
    insights_summary: visual.notes
  });

  const currentDashboard = dashboards.find(d => d.id === currentDashboardId);

  return (
    <div className="vta-layout">
      {/* Header */}
      <div className="vta-header">
        <div className="vta-header-content">
          <div className="vta-logo">
            <div className="vta-logo-icon">V</div>
            <div>
              <div className="vta-font-bold">VTA AI Assistant</div>
              <div className="vta-tagline">HR Recruitment Dashboard</div>
            </div>
          </div>
        </div>
        <div className="vta-header-actions">
          {currentDashboardId && (
            <button onClick={handleExportPDF} className="vta-btn-primary" style={{ marginRight: '1rem' }}>
              📄 Export PDF
            </button>
          )}
          <div className="vta-user-controls">
            <button className="vta-theme-toggle" title="Toggle Theme">
              🌙
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="vta-sidebar">
        <div className="vta-sidebar-header">
          <h2 className="vta-font-semibold" style={{ color: 'var(--vta-gray-900)' }}>Home</h2>
        </div>
        <div className="vta-sidebar-nav">
          <div className="vta-nav-item active">
            <span>🏠</span>
            <span>Dashboard</span>
          </div>
          <div className="vta-nav-item">
            <span>👥</span>
            <span>Candidates</span>
          </div>
          <div className="vta-nav-item">
            <span>💼</span>
            <span>Jobs</span>
          </div>
          <div className="vta-nav-item">
            <span>📅</span>
            <span>Interviews</span>
          </div>
          <div className="vta-nav-item">
            <span>📊</span>
            <span>Analytics</span>
          </div>
        </div>
        <div className="vta-sidebar-footer">
          <div className="vta-nav-item">
            <span>⚙️</span>
            <span>Settings</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="vta-main">
        <div className="vta-main-header">
          <div>
            <h1 className="vta-page-title">
              {currentDashboard ? currentDashboard.name : 'Dashboard'}
            </h1>
            <p className="vta-page-subtitle">Welcome to your HR recruitment dashboard</p>
          </div>
          <DashboardManager
            dashboards={dashboards}
            currentDashboardId={currentDashboardId}
            onSelectDashboard={handleSelectDashboard}
            onSaveDashboard={handleSaveDashboard}
            onDeleteDashboard={handleDeleteDashboard}
            onRenameDashboard={handleRenameDashboard}
          />
        </div>

        {/* Pinned Visuals with Grid Layout */}
        {pinnedVisuals.length > 0 && (
          <div id="dashboard-grid" className="vta-dashboard-grid">
            {/* @ts-ignore - react-grid-layout type compatibility */}
            <ResponsiveGridLayout
              className="layout"
              layouts={{ lg: layout as any, md: layout as any, sm: layout as any, xs: layout as any, xxs: layout as any }}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
              cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
              rowHeight={50}
              compactType="vertical"
              preventCollision={true}
              margin={[12, 12]}
              containerPadding={[10, 10]}
              useCSSTransforms={true}
              isBounded={false}
              onLayoutChange={(newLayout: any) => {
                const gridLayout: GridLayoutItem[] = newLayout.map((l: any) => ({
                  i: l.i.toString(),
                  x: l.x,
                  y: l.y,
                  w: l.w,
                  h: l.h,
                  minW: l.minW || 3,
                  minH: l.minH || 3,
                  maxW: l.maxW || 12,
                  maxH: l.maxH || 16
                }));
                handleLayoutChange(gridLayout);
              }}
              isDraggable={true}
              isResizable={true}
              draggableHandle=".vta-drag-handle"
            >
              {pinnedVisuals.map((visual) => (
                <div key={visual.id.toString()} className="vta-grid-item">
                  <div className="vta-drag-handle" style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    height: '24px', 
                    background: 'rgba(0,0,0,0.03)',
                    cursor: 'move',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    color: '#666',
                    zIndex: 10
                  }}>
                    ⋮⋮ Drag
                  </div>
                  <ChartComponent
                    data={convertToAnalyticsData(visual)}
                    onRemove={() => handleRemoveVisual(visual.id.toString())}
                    isPinned={true}
                    filters={visual.filters || []}
                    onFiltersChange={(filters) => handleFiltersChange(visual.id.toString(), filters)}
                  />
                </div>
              ))}
            </ResponsiveGridLayout>
          </div>
        )}

        {pinnedVisuals.length === 0 && (
          <div className="vta-empty-dashboard">
            <p>No visuals pinned yet. Use the AI Assistant to create and pin charts to your dashboard.</p>
          </div>
        )}
      </div>

      {/* Chatbot Panel */}
      <ChatWindow onPinVisual={handlePinVisual} />
    </div>
  );
}

export default App;
