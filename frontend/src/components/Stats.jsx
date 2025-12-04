import { Package, Star, TrendingUp, DollarSign } from 'lucide-react';
import { formatPrice } from '../utils/helpers';

function Stats({ stats }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <StatCard
        icon={<Package className="w-6 h-6 text-anime-secondary" />}
        label="Total Products"
        value={stats.trendingProducts || 0}
      />
      <StatCard
        icon={<Star className="w-6 h-6 text-yellow-500" />}
        label="Anime Series"
        value={stats.totalAnime || 0}
      />
      <StatCard
        icon={<DollarSign className="w-6 h-6 text-green-500" />}
        label="Avg. Price"
        value={formatPrice(stats.priceRange?.average || 0)}
      />
      <StatCard
        icon={<TrendingUp className="w-6 h-6 text-anime-primary" />}
        label="Min Score"
        value="60+"
      />
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-anime-darker rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-anime-dark rounded-lg">
          {icon}
        </div>
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className="text-white text-xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default Stats;
