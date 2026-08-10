import { useMapState } from '../context/MapStateContext';
import NavigationRail from './NavigationRail';
import MapControls from './MapControls';
import MapView from './MapView';
import GridView from './GridView';
import IsoView from './IsoView';
import Legend from './Legend';
import DashboardStats from './DashboardStats';
import AssetDetailsDrawer from './AssetDetailsDrawer';
import EmptyStateOverlay from './EmptyStateOverlay';

function MainView({ viewMode }) {
  if (viewMode === 'grid') return <GridView />;
  if (viewMode === 'iso') return <IsoView />;
  return <MapView />;
}

export default function AppShell() {
  const { viewMode } = useMapState();

  return (
    <>
      <div className="app-shell">
        <NavigationRail />
        <div className="controls-region">
          <MapControls />
        </div>
        <main className="map-view-region">
          <div className="map-canvas">
            <MainView viewMode={viewMode} />
            <Legend />
            <EmptyStateOverlay />
          </div>
        </main>
        <DashboardStats />
      </div>
      <AssetDetailsDrawer />
    </>
  );
}
