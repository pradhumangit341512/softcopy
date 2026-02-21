'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Card, { CardBody, CardHeader } from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Loader from '@/components/common/Loader';
import Alert from '@/components/common/Alert';
import Select from '@/components/common/Select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/common/Toast';
import Pagination from '@/components/common/Pagination';
import Button from '@/components/common/ Button';
import Modal from '@/components/common/ Modal';
import Input from '@/components/common/ Input';

interface Commission {
  id: string;
  clientId: string;
  client: { clientName: string };
  user: { name: string };
  dealAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  paidStatus: string;
  createdAt: string;
}

export default function CommissionsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState({ totalCommission: 0, pendingCommission: 0 });
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);

  useEffect(() => {
    fetchCommissions();
  }, [filter, page]);

  const fetchCommissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const filterParam = filter === 'all' ? '' : filter;
      const response = await fetch(
        `/api/commissions?paidStatus=${filterParam}&page=${page}`
      );
      if (!response.ok) throw new Error('Failed to fetch commissions');

      const data = await response.json();
      setCommissions(data.commissions);
      setTotals(data.totals);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (commissionId: string) => {
    try {
      const response = await fetch(`/api/commissions/${commissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidStatus: 'Paid' }),
      });

      if (!response.ok) throw new Error('Failed to update');

      addToast({
        type: 'success',
        message: 'Commission marked as paid',
      });

      fetchCommissions();
      setIsModalOpen(false);
    } catch (err) {
      addToast({
        type: 'error',
        message: String(err),
      });
    }
  };

  const chartData = [
    {
      status: 'Pending',
      amount: totals.pendingCommission,
    },
    {
      status: 'Paid',
      amount: totals.totalCommission - totals.pendingCommission,
    },
  ];

  return (
    <div className="py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Commissions</h1>
        <p className="text-gray-600 mt-1">Track all your earnings</p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          type="error"
          title="Error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Total Commission</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              ₹{totals.totalCommission.toLocaleString()}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Pending Amount</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">
              ₹{totals.pendingCommission.toLocaleString()}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Paid Amount</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              ₹{(totals.totalCommission - totals.pendingCommission).toLocaleString()}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader title="Commission Status Overview" />
        <CardBody>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip formatter={(value) => `₹${value}`} />
              <Legend />
              <Bar dataKey="amount" fill="#3b82f6" name="Amount (₹)" />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      {/* Filter & Table */}
      <Card>
        <CardHeader title="Commission Details" />
        <CardBody className="space-y-4">
          {/* Filter Buttons */}
          <div className="flex gap-2 mb-4">
            {(['all', 'pending', 'paid'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilter(f);
                  setPage(1);
                }}
              >
                {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Paid'}
              </Button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <Loader size="md" message="Loading commissions..." />
          ) : commissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No commissions found
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold">
                        Client
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">
                        Sales Person
                      </th>
                      <th className="px-4 py-2 text-right text-sm font-semibold">
                        Deal Amount
                      </th>
                      <th className="px-4 py-2 text-right text-sm font-semibold">
                        Commission %
                      </th>
                      <th className="px-4 py-2 text-right text-sm font-semibold">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-semibold">
                        Status
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((commission, index) => (
                      <tr
                        key={commission.id}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-4 py-3 text-sm font-medium">
                          {commission.client.clientName}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {commission.user.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          ₹{commission.dealAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {commission.commissionPercentage}%
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          ₹{commission.commissionAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            label={commission.paidStatus}
                            variant={
                              commission.paidStatus === 'Paid'
                                ? 'success'
                                : 'warning'
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {commission.paidStatus === 'Pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCommission(commission);
                                setIsModalOpen(true);
                              }}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4 border-t pt-4">
                <Pagination
                  currentPage={page}
                  totalPages={Math.ceil(commissions.length / 10)}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Mark as Paid Modal */}
      {selectedCommission && (
        <Modal
          isOpen={isModalOpen}
          title="Mark Commission as Paid"
          onClose={() => setIsModalOpen(false)}
          onSubmit={() =>
            handleMarkAsPaid(selectedCommission.id)
          }
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Client</p>
              <p className="text-lg font-semibold">
                {selectedCommission.client.clientName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Commission Amount</p>
              <p className="text-2xl font-bold text-green-600">
                ₹{selectedCommission.commissionAmount.toLocaleString()}
              </p>
            </div>
            <div>
              <Input
                label="Payment Reference (Optional)"
                placeholder="Cheque no., Transaction ID, etc."
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}