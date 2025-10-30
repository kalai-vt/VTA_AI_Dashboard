import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../types/message';

interface DashboardManagerProps {
  dashboards: DashboardLayout[];
  currentDashboardId: string | null;
  onSelectDashboard: (dashboardId: string) => void;
  onSaveDashboard: (name: string) => void;
  onDeleteDashboard: (dashboardId: string) => void;
  onRenameDashboard: (dashboardId: string, newName: string) => void;
}

const DashboardManager: React.FC<DashboardManagerProps> = ({
  dashboards,
  currentDashboardId,
  onSelectDashboard,
  onSaveDashboard,
  onDeleteDashboard,
  onRenameDashboard
}) => {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [dashboardName, setDashboardName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleSave = () => {
    if (dashboardName.trim()) {
      onSaveDashboard(dashboardName.trim());
      setDashboardName('');
      setShowSaveModal(false);
    }
  };

  const handleRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleRenameSubmit = (id: string) => {
    if (editName.trim()) {
      onRenameDashboard(id, editName.trim());
      setEditingId(null);
      setEditName('');
    }
  };

  return (
    <div className="vta-dashboard-manager">
      <div className="vta-dashboard-header">
        <select
          value={currentDashboardId || ''}
          onChange={(e) => onSelectDashboard(e.target.value)}
          className="vta-select"
        >
          <option value="">Select Dashboard</option>
          {dashboards.map(dashboard => (
            <option key={dashboard.id} value={dashboard.id}>
              {dashboard.name}
            </option>
          ))}
        </select>
        
        <button onClick={() => setShowSaveModal(true)} className="vta-btn-primary">
          💾 Save Dashboard
        </button>
      </div>

      {dashboards.length > 0 && (
        <div className="vta-dashboard-list">
          <h4>Saved Dashboards:</h4>
          {dashboards.map(dashboard => (
            <div key={dashboard.id} className={`vta-dashboard-item ${dashboard.id === currentDashboardId ? 'active' : ''}`}>
              {editingId === dashboard.id ? (
                <div className="vta-dashboard-edit">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRenameSubmit(dashboard.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit(dashboard.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="vta-input"
                    autoFocus
                  />
                </div>
              ) : (
                <>
                  <span onClick={() => onSelectDashboard(dashboard.id)}>{dashboard.name}</span>
                  <div className="vta-dashboard-actions">
                    <button onClick={() => handleRename(dashboard.id, dashboard.name)}>✏️</button>
                    <button onClick={() => onDeleteDashboard(dashboard.id)}>🗑️</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {showSaveModal && (
        <div className="vta-modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="vta-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="vta-modal-header">
              <h3>Save Dashboard</h3>
              <button onClick={() => setShowSaveModal(false)} className="vta-modal-close">×</button>
            </div>
            <div className="vta-modal-body">
              <input
                type="text"
                value={dashboardName}
                onChange={(e) => setDashboardName(e.target.value)}
                placeholder="Dashboard Name"
                className="vta-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                autoFocus
              />
            </div>
            <div className="vta-modal-footer">
              <button onClick={() => setShowSaveModal(false)} className="vta-btn-secondary">Cancel</button>
              <button onClick={handleSave} className="vta-btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardManager;

