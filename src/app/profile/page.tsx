
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db, storage } from '@/lib/firebase';
import { get, ref } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface UserProfile {
  id: string;
  uid: string;
  email: string;
  role: string;
  displayName: string;
  photoURL: string;
}

const ProfileSkeleton = () => (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>My Profile</CardTitle>
                <CardDescription>View and manage your personal information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="flex items-center gap-6">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-8 w-32" />
                    </div>
                </div>
                 <div className="space-y-4">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
);


export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        try {
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);
            if (snapshot.exists()) {
                const users = snapshot.val();
                const [id, dbUser] = Object.entries(users).find(([, userData]: [string, any]) => userData.uid === user.uid) || [];
                
                if (id && dbUser) {
                    setProfile({
                        id: id,
                        uid: user.uid,
                        email: user.email || '',
                        role: dbUser.role,
                        displayName: user.displayName || 'User',
                        photoURL: user.photoURL || '',
                    });
                }
            }
        } catch (error) {
            console.error("Failed to fetch profile:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load your profile.' });
        } finally {
            setLoading(false);
        }
      } else if (!authLoading) {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, authLoading, toast]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !user) return;
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
        const fileRef = storageRef(storage, `avatars/${user.uid}/${file.name}`);
        const snapshot = await uploadBytes(fileRef, file);
        const photoURL = await getDownloadURL(snapshot.ref);

        await updateProfile(user, { photoURL });
        setProfile(prev => prev ? { ...prev, photoURL } : null);

        toast({ title: 'Success', description: 'Profile picture updated successfully!' });
    } catch (error) {
        console.error("Image upload failed:", error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload the new image.' });
    } finally {
        setUploading(false);
    }
  };


  if (loading || authLoading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return <div className="text-center text-muted-foreground">Could not load profile. Please try logging in again.</div>
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
          <CardDescription>View and manage your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
            <div className="flex items-center gap-6">
                <div className="relative">
                    <Avatar className="h-24 w-24 border">
                        <AvatarImage src={profile.photoURL} alt={profile.displayName} />
                        <AvatarFallback className="text-3xl">
                            {getInitials(profile.displayName)}
                        </AvatarFallback>
                    </Avatar>
                     <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 cursor-pointer rounded-full bg-primary p-2 text-primary-foreground shadow-md hover:bg-primary/90">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pen className="h-4 w-4" />}
                        <input id="avatar-upload" type="file" className="sr-only" onChange={handleImageUpload} accept="image/*" disabled={uploading} />
                    </label>
                </div>
                <div>
                    <h2 className="text-2xl font-bold">{profile.displayName}</h2>
                    <p className="text-muted-foreground capitalize">{profile.role}</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="id">ID</Label>
                    <Input id="id" value={profile.id} readOnly disabled />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" value={profile.email} readOnly disabled />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input id="displayName" value={profile.displayName} readOnly disabled />
                    <p className="text-xs text-muted-foreground">To change your name, please contact an administrator.</p>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Button variant="outline" disabled>Change Password (Coming Soon)</Button>
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
