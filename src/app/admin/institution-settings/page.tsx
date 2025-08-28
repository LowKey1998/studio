
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Trash2, PlusCircle, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { ref, update, onValue } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { removeBackground } from '@/ai/flows/remove-background-flow';

type NamePart = {
  text: string;
  color: string;
};

type Institution = {
  name: string;
  logoUrl?: string;
  color?: string;
  nameParts?: NamePart[];
};

export default function InstitutionSettingsPage() {
    const [institution, setInstitution] = React.useState<Institution>({ name: 'Edutrack360', nameParts: [] });
    const [logoFile, setLogoFile] = React.useState<File | null>(null);
    const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const settingsRef = ref(db, 'settings/institution');
        const unsub = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setInstitution({
                    name: data.name || 'Edutrack360',
                    logoUrl: data.logoUrl,
                    color: data.color,
                    nameParts: data.nameParts || (data.name ? data.name.split(' ').map((word: string) => ({ text: word, color: '#000000' })) : [])
                });
            } else {
                 setInstitution({ name: 'Edutrack360', nameParts: [{text: 'Edutrack360', color: '#000000'}] });
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);
    
    const handleNameChange = (newName: string) => {
        const parts = newName.split(' ').map(word => {
            const existingPart = institution.nameParts?.find(p => p.text === word);
            return existingPart || { text: word, color: '#000000' };
        });
        setInstitution(prev => ({ ...prev, name: newName, nameParts: parts }));
    };

    const handlePartTextChange = (index: number, text: string) => {
        const newParts = [...(institution.nameParts || [])];
        newParts[index].text = text;
        setInstitution(prev => ({ ...prev, nameParts: newParts, name: newParts.map(p => p.text).join(' ') }));
    };

    const handlePartColorChange = (index: number, color: string) => {
        const newParts = [...(institution.nameParts || [])];
        newParts[index].color = color;
        setInstitution(prev => ({ ...prev, nameParts: newParts }));
    };

    const handleRemoveBackground = async () => {
        if (!logoFile && !institution.logoUrl) {
            toast({ variant: 'destructive', title: 'No logo selected', description: 'Please upload a logo first.' });
            return;
        }

        setSaving(true);
        toast({ title: 'AI Magic in Progress...', description: 'Removing the logo background. This may take a moment.' });
        
        const imageUrl = logoPreview || institution.logoUrl!;
        
        try {
            // Convert to data URI if it's not already one
            let dataUri = imageUrl;
            if (!imageUrl.startsWith('data:image')) {
                 const response = await fetch(imageUrl);
                 const blob = await response.blob();
                 const reader = new FileReader();
                 dataUri = await new Promise((resolve) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                 });
            }

            const result = await removeBackground({ imageUrl: dataUri });
            setLogoPreview(result.imageWithTransparentBackground);
            
            // To make this savable, we need to convert the data URI back to a blob/file
            const blob = await (await fetch(result.imageWithTransparentBackground)).blob();
            const newFile = new File([blob], "logo_transparent.png", { type: "image/png" });
            setLogoFile(newFile);
            
            setInstitution(prev => ({ ...prev, logoUrl: result.imageWithTransparentBackground }));
            toast({ variant: 'success', title: 'Background Removed!', description: 'The logo now has a transparent background. Dont forget to save.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'AI Failed', description: error.message || 'Could not remove background.' });
        } finally {
            setSaving(false);
        }
    };


    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const settingsRef = ref(db, 'settings/institution');
            
            let finalLogoUrl = institution.logoUrl;

            if (logoFile) {
                const logoStorageRef = storageRef(storage, `institution/logo_${Date.now()}`);
                const snapshot = await uploadBytes(logoStorageRef, logoFile);
                finalLogoUrl = await getDownloadURL(snapshot.ref);
            }
            
            await update(settingsRef, { 
                name: institution.name,
                logoUrl: finalLogoUrl,
                color: institution.color,
                nameParts: institution.nameParts,
            });
            toast({ variant: 'success', title: 'Settings Saved' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSaveChanges} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Institution Settings</CardTitle>
                    <CardDescription>Set your institution's name, logo, and primary color for branding on documents and the portal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-start">
                        <Label htmlFor="institution-name">Institution Name</Label>
                        <div className="sm:col-span-2 space-y-4">
                            <Input id="institution-name" value={institution.name} onChange={(e) => handleNameChange(e.target.value)} className="max-w-sm" disabled={saving} />
                            <div className="space-y-2">
                                {institution.nameParts?.map((part, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <Input value={part.text} onChange={(e) => handlePartTextChange(index, e.target.value)} disabled={saving} />
                                        <Input type="color" value={part.color} onChange={(e) => handlePartColorChange(index, e.target.value)} className="w-12 h-10 p-1" disabled={saving}/>
                                    </div>
                                ))}
                            </div>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-start"><Label htmlFor="institution-logo">Institution Logo</Label><div className="sm:col-span-2 flex items-center gap-4">
                        <div className="w-20 h-20 rounded-md border p-1 flex items-center justify-center bg-muted">
                            {logoPreview || institution.logoUrl ? (<Image src={logoPreview || institution.logoUrl!} alt="Logo Preview" width={80} height={80} className="object-contain" data-ai-hint="logo"/>) : (<span className="text-xs text-muted-foreground">No Logo</span>)}
                        </div>
                        <div className="space-y-2">
                            <Input id="institution-logo" type="file" onChange={(e) => { const file = e.target.files?.[0]; if(file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file));}}} accept="image/*" className="max-w-xs"/>
                            <Button type="button" variant="outline" size="sm" onClick={handleRemoveBackground} disabled={saving || (!logoFile && !institution.logoUrl)}>
                                <Wand2 className="mr-2 h-4 w-4"/>
                                Remove Background (AI)
                            </Button>
                        </div>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center"><Label htmlFor="institution-color">Primary Theme Color</Label><div className="sm:col-span-2"><Input id="institution-color" type="color" value={institution.color || '#4c1d95'} onChange={(e) => setInstitution(p => ({...p, color: e.target.value}))} className="w-24 h-12 p-1" disabled={saving}/></div></div>
                </CardContent>
                <CardFooter className="border-t pt-6">
                     <Button type="submit" disabled={saving || loading}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2"/>} Save Changes
                    </Button>
                </CardFooter>
            </Card>
        </form>
    )
}
