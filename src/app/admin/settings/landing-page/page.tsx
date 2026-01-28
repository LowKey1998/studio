
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Upload, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { ref, update, onValue } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type LandingPageSettings = {
  heroImageUrl?: string;
  featuresImageUrl?: string;
};

export default function LandingPageContentPage() {
    const [settings, setSettings] = React.useState<LandingPageSettings>({});
    const [heroImageFile, setHeroImageFile] = React.useState<File | null>(null);
    const [featuresImageFile, setFeaturesImageFile] = React.useState<File | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const settingsRef = ref(db, 'settings/landingPage');
        const unsub = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                setSettings(snapshot.val());
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<File | null>>) => {
        const file = e.target.files?.[0];
        if (file) {
            setter(file);
        }
    };

    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const settingsRef = ref(db, 'settings/landingPage');
            const updates: LandingPageSettings = {};
            
            if (heroImageFile) {
                const heroStorageRef = storageRef(storage, `landingPage/hero_${Date.now()}`);
                const snapshot = await uploadBytes(heroStorageRef, heroImageFile);
                updates.heroImageUrl = await getDownloadURL(snapshot.ref);
            }
            if (featuresImageFile) {
                 const featuresStorageRef = storageRef(storage, `landingPage/features_${Date.now()}`);
                const snapshot = await uploadBytes(featuresStorageRef, featuresImageFile);
                updates.featuresImageUrl = await getDownloadURL(snapshot.ref);
            }
            
            await update(settingsRef, updates);
            toast({ variant: 'success', title: 'Landing Page Updated' });
            setHeroImageFile(null);
            setFeaturesImageFile(null);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };
    
    return (
        <form onSubmit={handleSaveChanges}>
            <Card>
                <CardHeader>
                    <CardTitle>Landing Page Content</CardTitle>
                    <CardDescription>Manage the background images for the public landing page.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                     <div className="space-y-2">
                        <Label htmlFor="hero-image" className="text-lg font-semibold">Hero Section Background</Label>
                        <Card>
                            <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                                <div className="w-full md:w-1/3">
                                     <div className="aspect-video w-full relative bg-muted rounded-md overflow-hidden">
                                        <Image src={heroImageFile ? URL.createObjectURL(heroImageFile) : settings.heroImageUrl || "https://picsum.photos/600/400"} alt="Hero preview" layout="fill" objectFit="cover" />
                                    </div>
                                </div>
                                <div className="w-full md:w-2/3">
                                    <Input id="hero-image" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setHeroImageFile)} />
                                    <p className="text-xs text-muted-foreground mt-2">Recommended size: 1920x1080px. Max file size: 5MB.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="features-image" className="text-lg font-semibold">Features Section Background</Label>
                        <Card>
                            <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                                <div className="w-full md:w-1/3">
                                     <div className="aspect-video w-full relative bg-muted rounded-md overflow-hidden">
                                        <Image src={featuresImageFile ? URL.createObjectURL(featuresImageFile) : settings.featuresImageUrl || "https://picsum.photos/600/400"} alt="Features preview" layout="fill" objectFit="cover" />
                                    </div>
                                </div>
                                <div className="w-full md:w-2/3">
                                    <Input id="features-image" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setFeaturesImageFile)} />
                                     <p className="text-xs text-muted-foreground mt-2">This image will be used as a background overlay. A subtle pattern or abstract texture works best.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={saving || loading}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2"/>} Save Changes
                    </Button>
                </CardFooter>
            </Card>
        </form>
    )
}
