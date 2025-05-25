import React, { useState } from 'react';
import api from '@/api/axios';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'react-toastify';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [realName, setRealName] = useState('');
  const [role, setRole] = useState('player');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/register/', { username, email, password, phone, real_name: realName, role });
      toast.success('Registration successful! Check your email to verify.');
      navigate('/login');
    } catch (err) {
      toast.error('Registration failed');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="p-8 w-96">
        <CardContent>
          <h2 className="text-xl mb-4">Register</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
            />
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
            />
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
            />
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Phone"
            />
            <Input
              value={realName}
              onChange={e => setRealName(e.target.value)}
              placeholder="Real Name (optional)"
            />
            <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose role: " />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="referee">Referee</SelectItem>
                </SelectContent>
            </Select>
            <Button type="submit" className="w-full">Sign Up</Button>
          </form>
          <p className="mt-4 text-center">
            Already have an account? <Link to="/login" className="text-blue-500">Login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}