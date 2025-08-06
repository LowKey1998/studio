
'use client';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { storage, db } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, update, get } from 'firebase/database';
import { Loader2, Camera } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { Label } from './ui/label';

type ProfileDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
};

type UserProfile = {
    name: string;
    email: string;
    id: string; // The system ID like STU-001
    phoneNumber?: string;
    profilePictureUrl?: string;
}

export function ProfileDialog({ isOpen, onOpenChange, userId }: ProfileDialogProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [profileData, setProfileData] = React.useState<UserProfile | null>(null);
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [loadingInitial, setLoadingInitial] = React.useState(true);
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const fetchUserData = async () => {
        if (!userId || !isOpen) return;
        setLoadingInitial(true);
        try {
            const userRef = dbRef(db, `users/${userId}`);
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                setProfileData(data);
                setPhoneNumber(data.phoneNumber || '');
            } else {
                setProfileData(null);
            }
        } catch (error) {
            console.error("Failed to fetch user data:", error);
            setProfileData(null);
        } finally {
            setLoadingInitial(false);
        }
    };

    fetchUserData();
  }, [userId, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          variant: 'destructive',
          title: 'File Too Large',
          description: 'Please select an image smaller than 2MB.',
        });
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!userId) return;
    if (!file && phoneNumber === (profileData?.phoneNumber || '')) {
         toast({
            variant: 'default',
            title: 'No Changes',
            description: 'No new picture was selected and phone number is unchanged.',
        });
        return;
    }


    setUploading(true);
    try {
      let downloadURL = profileData?.profilePictureUrl;
      if (file) {
        const imageRef = storageRef(storage, `profilePictures/${userId}/${file.name}`);
        const snapshot = await uploadBytes(imageRef, file);
        downloadURL = await getDownloadURL(snapshot.ref);
      }

      const userRef = dbRef(db, `users/${userId}`);
      await update(userRef, {
        profilePictureUrl: downloadURL,
        phoneNumber: phoneNumber
      });

      toast({
        variant: 'success',
        title: 'Success!',
        description: 'Your profile has been updated.',
      });
      
      handleClose();

    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'There was an error updating your profile. Please try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  }

  const displayImage = preview || profileData?.profilePictureUrl || "https://placehold.co/128x128.png";
  const userInitial = profileData?.name?.charAt(0).toUpperCase() || '?';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => {
          if (uploading) e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle className="font-headline">Your Profile</DialogTitle>
          <DialogDescription>
            View your details or update your profile picture and phone number.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
            <div className="flex flex-col items-center gap-4">
                <Input 
                    id="picture" 
                    type="file" 
                    accept="image/png, image/jpeg, image/gif"
                    onChange={handleFileChange} 
                    className="hidden"
                    ref={fileInputRef}
                    disabled={uploading}
                />
                 {loadingInitial ? (
                    <Skeleton className="h-32 w-32 rounded-full" />
                 ) : (
                    <div 
                        className="group relative cursor-pointer"
                        onClick={() => !uploading && fileInputRef.current?.click()}
                    >
                        <Avatar className="h-32 w-32">
                            <AvatarImage src={displayImage} alt="Profile preview" data-ai-hint="person avatar" />
                            <AvatarFallback className="text-3xl">{userInitial}</AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 flex flex-col justify-end rounded-full bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="flex h-1/3 items-center justify-center gap-2 rounded-b-full bg-black/50 text-white backdrop-blur-sm">
                                <Camera className="h-4 w-4" />
                                <span className="text-sm">Change</span>
                            </div>
                        </div>
                    </div>
                 )}
                {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
            </div>
            
            <div className="space-y-4">
                 {loadingInitial ? (
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                 ) : profileData ? (
                    <>
                    <div className="space-y-1">
                        <Label htmlFor="profile-name">Full Name</Label>
                        <Input id="profile-name" value={profileData.name} readOnly disabled />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="profile-id">User ID</Label>
                        <Input id="profile-id" value={profileData.id} readOnly disabled />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="profile-email">Email</Label>
                        <Input id="profile-email" value={profileData.email} readOnly disabled />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="profile-phone">Phone Number</Label>
                        <Input id="profile-phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} disabled={uploading}/>
                    </div>
                    </>
                 ) : (
                    <p className="text-sm text-center text-muted-foreground">Could not load profile details.</p>
                 )}
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={handleClose} disabled={uploading}>Close</Button>
          </DialogClose>
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
