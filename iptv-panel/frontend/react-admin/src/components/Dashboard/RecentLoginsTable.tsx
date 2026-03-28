import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

interface Login {
  username: string;
  last_login: string;
  last_login_ip: string;
  role: string;
}

export function RecentLoginsTable({ logins }: { logins: Login[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Logins</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50">
              <th className="text-left py-3 px-4 font-medium text-gray-500">Username</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Role</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">IP Address</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {logins.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">No recent logins</td>
              </tr>
            ) : (
              logins.map((l, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{l.username}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      l.role === 'admin' ? 'bg-red-100 text-red-700' :
                      l.role === 'reseller' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {l.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-600 dark:text-gray-400">
                    {l.last_login_ip || '—'}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">
                    {l.last_login ? dayjs(l.last_login).fromNow() : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
