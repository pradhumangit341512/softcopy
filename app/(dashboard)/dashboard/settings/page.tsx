'use client';

import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import Card, { CardBody, CardHeader } from '@/components/common/Card';
import Tabs from '@/components/common/Tabs';
import Loader from '@/components/common/Loader';
import Alert from '@/components/common/Alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/common/Toast';
import Button from '@/components/common/ Button';
import Input from '@/components/common/ Input';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Update failed');

      addToast({
        type: 'success',
        message: 'Profile updated successfully!',
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: 'Failed to update profile',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast({
        type: 'error',
        message: 'Passwords do not match',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: user?.email,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      });

      if (!response.ok) throw new Error('Update failed');

      addToast({
        type: 'success',
        message: 'Password changed successfully!',
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: 'Failed to change password',
      });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    {
      id: 'profile',
      label: 'Profile',
      content: (
        <Card>
          <CardHeader title="Profile Information" />
          <CardBody>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="flex items-center gap-6 mb-6">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
                  <Camera className="w-8 h-8 text-blue-600" />
                </div>
                <Button variant="outline">Change Photo</Button>
              </div>

              <Input
              className='text-black'
                label="Full Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />

              <Input
              className='text-black'

                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />

              <Input
              className='text-black'

                label="Phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />

              <div className="flex gap-3 pt-4">
                <Button type="submit" loading={loading}>
                  Save Changes
                </Button>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ),
    },
    {
      id: 'password',
      label: 'Security',
      content: (
        <Card>
          <CardHeader title="Change Password" />
          <CardBody>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    currentPassword: e.target.value,
                  })
                }
                required
              />

              <Input
                label="New Password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    newPassword: e.target.value,
                  })
                }
                required
              />

              <Input
                label="Confirm Password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
                required
              />

              <div className="flex gap-3 pt-4">
                <Button type="submit" loading={loading}>
                  Update Password
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ),
    },
    {
      id: 'account',
      label: 'Account',
      content: (
        <Card>
          <CardHeader title="Account Settings" />
          <CardBody className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Account Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Role</p>
                  <p className="font-medium text-gray-900 mt-1 capitalize">
                    {user?.role}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Member Since</p>
                  <p className="font-medium text-gray-900 mt-1">
                    {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-2">Danger Zone</h3>
              <p className="text-sm text-gray-600 mb-4">
                Once you logout, you'll need to sign in again to access your account.
              </p>
              <Button variant="danger" onClick={logout}>
                Logout
              </Button>
            </div>
          </CardBody>
        </Card>
      ),
    },
  ];

  return (
    <div className="py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account preferences</p>
      </div>

      {/* Settings Tabs */}
      <Tabs tabs={tabs} defaultTab="profile" />
    </div>
  );
}