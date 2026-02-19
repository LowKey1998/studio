
"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Wand2, Trash2, Palette, DollarSign, Info, ReceiptText, Percent, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { ref, update, onValue } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { removeBackground } from '@/ai/flows/remove-background-flow';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';

type NamePart = {
  text: string;
  color: string;
};

type Institution = {
  name: string;
  logoUrl?: string | null;
  color?: string;
  topBarColor?: string;
  sidebarColor?: string;
  sidebarTextColor?: string;
  nameParts?: NamePart[];
  billingPolicy?: 'course' | 'semester';
  // Invoice Settings
  currencyCode?: string;
  currencySymbol?: string;
  invoicePrefix?: string;
  invoiceFooter?: string;
  taxLabel?: string;
  taxRate?: number;
};

export default function InstitutionSettingsPage() {
    const [institution, setInstitution] = React.useState<Institution>({ 
        name: 'Edutrack360', 
        nameParts: [],
        topBarColor: '#ffffff',
        sidebarColor: '#ffffff',
        sidebarTextColor: '#000000',
        billingPolicy: 'course',
        currencyCode: 'ZMW',
        currencySymbol: 'K',
        invoicePrefix: 'INV',
        invoiceFooter: 'Please use your Student ID as the reference for all bank deposits.',
        taxLabel: 'VAT',
        taxRate: 0
    });
    const [logoFile, setLogoFile] = React.useState<File | null>(null);
    const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
    const [logoAction, setLogoAction] = React.useState<'keep' | 'remove' | 'upload'>('keep');
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
                    color: data.color || '#4c1d95',
                    topBarColor: data.topBarColor || '#ffffff',
                    sidebarColor: data.sidebarColor || '#ffffff',
                    sidebarTextColor: data.sidebarTextColor || '#000000',
                    nameParts: data.nameParts || (data.name ? data.name.split(' ').map((word: string) => ({ text: word, color: '#000000' })) : []),
                    billingPolicy: data.billingPolicy || 'course',
                    currencyCode: data.currencyCode || 'ZMW',
                    currencySymbol: data.currencySymbol || 'K',
                    invoicePrefix: data.invoicePrefix || 'INV',
                    invoiceFooter: data.invoiceFooter || 'Please use your Student ID as the reference for all bank deposits.',
                    taxLabel: data.taxLabel || 'VAT',
                    taxRate: data.taxRate ?? 0
                });
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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
            setLogoAction('upload');
        }
    };

    const handleRemoveLogo = () => {
        if (window.confirm("Are you sure you want to remove the logo? This will be finalized when you save changes.")) {
            setLogoFile(null);
            setLogoPreview(null);
            setInstitution(prev => ({ ...prev, logoUrl: null }));
            setLogoAction('remove');
            toast({ title: 'Logo Marked for Removal' });
        }
    };

    const handleRemoveBackground = async () => {
        const imageUrl = logoPreview || institution.logoUrl;
        if (!imageUrl) {
            toast({ variant: 'destructive', title: 'No logo selected' });
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = async () => {
                const dataUri = reader.result as string;
                try {
                    const result = await removeBackground({ imageUrl: dataUri });
                    setLogoPreview(result.imageWithTransparentBackground);
                    const newBlob = await (await fetch(result.imageWithTransparentBackground)).blob();
                    const newFile = new File([newBlob], "logo_transparent.png", { type: "image/png" });
                    setLogoFile(newFile);
                    setLogoAction('upload');
                    toast({ variant: 'success', title: 'Background Removed!' });
                } catch (aiError: any) {
                    toast({ variant: 'destructive', title: 'AI Failed', description: aiError.message });
                } finally {
                    setSaving(false);
                }
            };
            reader.readAsDataURL(blob);
        } catch (fetchError: any) {
             toast({ variant: 'destructive', title: 'Image Fetch Failed' });
             setSaving(false);
        }
    };

    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const settingsRef = ref(db, 'settings/institution');
            let finalLogoUrl = institution.logoUrl;

            if (logoAction === 'upload' && logoFile) {
                const logoStorageRef = storageRef(storage, `institution/logo_${Date.now()}`);
                const snapshot = await uploadBytes(logoStorageRef, logoFile);
                finalLogoUrl = await getDownloadURL(snapshot.ref);
            } else if (logoAction === 'remove') {
                finalLogoUrl = null;
            }
            
            const updates = { 
                name: institution.name,
                logoUrl: finalLogoUrl,
                color: institution.color,
                topBarColor: institution.topBarColor,
                sidebarColor: institution.sidebarColor,
                sidebarTextColor: institution.sidebarTextColor,
                nameParts: institution.nameParts,
                billingPolicy: institution.billingPolicy,
                currencyCode: institution.currencyCode,
                currencySymbol: institution.currencySymbol,
                invoicePrefix: institution.invoicePrefix,
                invoiceFooter: institution.invoiceFooter,
                taxLabel: institution.taxLabel,
                taxRate: Number(institution.taxRate)
            };

            await update(settingsRef, updates);
            setLogoAction('keep');
            toast({ variant: 'success', title: 'Settings Saved' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const currentLogoUrl = logoAction === 'remove' ? null : logoPreview || institution.logoUrl;

    if (loading) return <Skeleton className="h-screen w-full" />;

    return (
        <form onSubmit={handleSaveChanges} className="space-y-6 pb-12">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Institution Settings</CardTitle>
                    <CardDescription>Set your institution's name, logo, and theme colors for consistent branding.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
                        <Label htmlFor="institution-name" className="pt-2">Institution Name</Label>
                        <div className="sm:col-span-2 space-y-4">
                            <Input id="institution-name" value={institution.name} onChange={(e) => handleNameChange(e.target.value)} className="max-w-sm" disabled={saving} />
                            <div className="space-y-2">
                                {institution.nameParts?.map((part, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <Input value={part.text} onChange={(e) => handlePartTextChange(index, e.target.value)} disabled={saving} />
                                        <Input type="color" value={part.color} onChange={(e) => handlePartColorChange(index, e.target.value)} className="w-12 h-10 p-1 shrink-0" disabled={saving}/>
                                    </div>
                                ))}
                            </div>
                        </div>
                     </div>

                     <Separator />

                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
                        <Label className="pt-2 text-base font-bold flex items-center gap-2"><DollarSign className="h-4 w-4"/> Tuition & Billing Policy</Label>
                        <div className="sm:col-span-2 space-y-4">
                            <Alert className="bg-primary/5 border-primary/20 max-w-2xl">
                                <Info className="h-4 w-4 text-primary" />
                                <AlertTitle className="font-bold">Billing Strategy</AlertTitle>
                                <AlertDescription className="text-xs leading-relaxed italic">
                                    This setting determines how tuition is calculated for students during registration.
                                </AlertDescription>
                            </Alert>
                            <RadioGroup 
                                value={institution.billingPolicy || 'course'} 
                                onValueChange={(val) => setInstitution(p => ({...p, billingPolicy: val as any}))}
                                className="grid gap-4 max-w-2xl"
                            >
                                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                                    <RadioGroupItem value="course" id="policy-course" className="mt-1" />
                                    <Label htmlFor="policy-course" className="cursor-pointer space-y-1">
                                        <p className="font-bold">Pay Per Course</p>
                                        <p className="text-xs text-muted-foreground font-normal leading-snug">Students are billed based on the sum of individual costs for each course they select. Ideal for part-time or flexible credit-based programs.</p>
                                    </Label>
                                </div>
                                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                                    <RadioGroupItem value="semester" id="policy-semester" className="mt-1" />
                                    <Label htmlFor="policy-semester" className="cursor-pointer space-y-1">
                                        <p className="font-bold">Flat Semester Fee</p>
                                        <p className="text-xs text-muted-foreground font-normal leading-snug">Students are billed a fixed tuition amount for the entire programme per semester, regardless of the number of courses selected. Ideal for full-time cohorts.</p>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                     </div>

                     <Separator />

                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
                        <Label className="pt-2 text-base font-bold flex items-center gap-2"><ReceiptText className="h-4 w-4"/> Invoice Format Settings</Label>
                        <div className="sm:col-span-2 space-y-6 max-w-2xl">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="invoice-prefix">Invoice Prefix</Label>
                                    <Input id="invoice-prefix" value={institution.invoicePrefix} onChange={(e) => setInstitution(p => ({...p, invoicePrefix: e.target.value.toUpperCase()}))} placeholder="e.g., INV" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="currency-code">Currency Code</Label>
                                    <Input id="currency-code" value={institution.currencyCode} onChange={(e) => setInstitution(p => ({...p, currencyCode: e.target.value.toUpperCase()}))} placeholder="e.g., ZMW" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="currency-symbol">Currency Symbol</Label>
                                    <Input id="currency-symbol" value={institution.currencySymbol} onChange={(e) => setInstitution(p => ({...p, currencySymbol: e.target.value}))} placeholder="e.g., K" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="tax-label">Tax Label</Label>
                                        <Input id="tax-label" value={institution.taxLabel} onChange={(e) => setInstitution(p => ({...p, taxLabel: e.target.value.toUpperCase()}))} placeholder="e.g., VAT" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                                        <div className="relative">
                                            <Input id="tax-rate" type="number" value={institution.taxRate} onChange={(e) => setInstitution(p => ({...p, taxRate: Number(e.target.value)}))} className="pr-8" />
                                            <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="invoice-footer" className="flex items-center gap-2"><FileText className="h-3 w-3"/> Invoice Footer Notes</Label>
                                <Textarea id="invoice-footer" value={institution.invoiceFooter} onChange={(e) => setInstitution(p => ({...p, invoiceFooter: e.target.value}))} placeholder="Payment instructions, bank details, or legal notes..." rows={4} />
                            </div>
                        </div>
                     </div>

                     <Separator />

                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
                        <Label className="pt-2">Institution Logo</Label>
                        <div className="sm:col-span-2 flex items-center gap-4">
                            <div className="w-20 h-20 rounded-md border p-1 flex items-center justify-center bg-muted">
                                {currentLogoUrl ? (<img src={currentLogoUrl} alt="Logo Preview" width={80} height={80} className="object-contain" />) : (<span className="text-xs text-muted-foreground">No Logo</span>)}
                            </div>
                            <div className="flex flex-col gap-2">
                                <Input id="institution-logo" type="file" onChange={handleFileSelect} accept="image/*" className="max-w-xs"/>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={handleRemoveBackground} disabled={saving || !currentLogoUrl}>
                                        <Wand2 className="mr-2 h-4 w-4"/>
                                        Remove Background (AI)
                                    </Button>
                                    <Button type="button" variant="destructive" size="sm" onClick={handleRemoveLogo} disabled={saving || !currentLogoUrl}>
                                        <Trash2 className="mr-2 h-4 w-4"/>
                                        Remove Logo
                                    </Button>
                                </div>
                            </div>
                        </div>
                     </div>

                     <Separator />

                     <div className="space-y-6">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><Palette className="h-5 w-5 text-primary"/> Visual Identity & Theme</h3>
                        
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:items-center">
                            <div className="space-y-1">
                                <Label htmlFor="institution-color">Brand Accent Color</Label>
                                <p className="text-xs text-muted-foreground">Used for buttons, links, and primary accents.</p>
                            </div>
                            <div className="sm:col-span-2">
                                <Input id="institution-color" type="color" value={institution.color || '#4c1d95'} onChange={(e) => setInstitution(p => ({...p, color: e.target.value}))} className="w-24 h-12 p-1" disabled={saving}/>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:items-center">
                            <div className="space-y-1">
                                <Label htmlFor="top-bar-color">Top Bar Background</Label>
                                <p className="text-xs text-muted-foreground">Customize the global header color.</p>
                            </div>
                            <div className="sm:col-span-2">
                                <Input id="top-bar-color" type="color" value={institution.topBarColor || '#ffffff'} onChange={(e) => setInstitution(p => ({...p, topBarColor: e.target.value}))} className="w-24 h-12 p-1" disabled={saving}/>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:items-center">
                            <div className="space-y-1">
                                <Label htmlFor="sidebar-color">Sidebar Background</Label>
                                <p className="text-xs text-muted-foreground">Customize the main navigation menu color.</p>
                            </div>
                            <div className="sm:col-span-2">
                                <Input id="sidebar-color" type="color" value={institution.sidebarColor || '#ffffff'} onChange={(e) => setInstitution(p => ({...p, sidebarColor: e.target.value}))} className="w-24 h-12 p-1" disabled={saving}/>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:items-center">
                            <div className="space-y-1">
                                <Label htmlFor="sidebar-text-color">Sidebar Text Color</Label>
                                <p className="text-xs text-muted-foreground">Ensure contrast against the sidebar background.</p>
                            </div>
                            <div className="sm:col-span-2">
                                <Input id="sidebar-text-color" type="color" value={institution.sidebarTextColor || '#000000'} onChange={(e) => setInstitution(p => ({...p, sidebarTextColor: e.target.value}))} className="w-24 h-12 p-1" disabled={saving}/>
                            </div>
                        </div>
                     </div>
                </CardContent>
                <CardFooter className="border-t pt-6">
                     <Button type="submit" disabled={saving || loading}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2"/>} Save Settings
                    </Button>
                </CardFooter>
            </Card>
        </form>
    )
}
