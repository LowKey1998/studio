'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2, Percent, AlertCircle, Pencil } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type AssessmentComponent = {
    id: string;
    name: string;
    weight: number;
};

type AssessmentTemplate = {
    id: string;
    name: string;
    components: Record<string, Omit<AssessmentComponent, 'id'>>;
};

export default function AssessmentSetupPage() {
    const [templates, setTemplates] = React.useState<AssessmentTemplate[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<AssessmentTemplate | null>(null);
    const [templateName, setTemplateName] = React.useState('');
    const [components, setComponents] = React.useState<AssessmentComponent[]>([]);

    const { toast } = useToast();

    React.useEffect(() => {
        const templatesRef = ref(db, 'settings/assessmentTemplates');
        const unsub = onValue(templatesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setTemplates(Object.keys(data).map(id => ({ 
                    id, 
                    name: data[id].name,
                    components: data[id].components || {}
                })));
            } else {
                setTemplates([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setTemplateName('');
        setComponents([{ id: `new-${Date.now()}`, name: '', weight: 0 }]);
        setEditingTemplate(null);
    };
    
    const openDialog = (template: AssessmentTemplate | null) => {
        if (template) {
            setEditingTemplate(template);
            setTemplateName(template.name);
            setComponents(template.components ? Object.entries(template.components).map(([id, comp]) => ({id, ...comp})) : [{ id: `new-${Date.now()}`, name: '', weight: 0 }]);
        } else {
            resetForm();
        }
        setIsDialogOpen(true);
    };

    const handleComponentChange = (id: string, field: 'name' | 'weight', value: string | number) => {
        setComponents(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const addComponent = () => {
        setComponents(prev => [...prev, { id: `new-${Date.now()}`, name: '', weight: 0 }]);
    };
    
    const removeComponent = (id: string) => {
        setComponents(prev => prev.filter(c => c.id !== id));
    };
    
    const totalWeight = React.useMemo(() => components.reduce((sum, c) => sum + (Number(c.weight) || 0), 0), [components]);


    const handleSaveTemplate = async () => {
        if (!templateName.trim() || components.length === 0) {
            toast({ variant: 'destructive', title: 'Name and at least one component are required.' }); return;
        }
        if (totalWeight !== 100) {
            toast({ variant: 'destructive', title: 'Total weight must be exactly 100%.' }); return;
        }
        if (components.some(c => !c.name.trim() || !c.weight)) {
            toast({ variant: 'destructive', title: 'All components must have a name and weight.' }); return;
        }

        setSaving(true);
        try {
            const componentsData: Record<string, Omit<AssessmentComponent, 'id'>> = {};
            components.forEach(comp => {
                const compId = comp.id.startsWith('new-') ? push(ref(db)).key! : comp.id;
                componentsData[compId] = { name: comp.name, weight: Number(comp.weight) };
            });

            const templateData = { name: templateName, components: componentsData };

            if (editingTemplate) {
                await update(ref(db, `settings/assessmentTemplates/${editingTemplate.id}`), templateData);
                toast({ title: 'Template Updated' });
            } else {
                await push(ref(db, 'settings/assessmentTemplates'), templateData);
                toast({ title: 'Template Created' });
            }
            resetForm();
            setIsDialogOpen(false);
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Failed to save template', description: e.message });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDeleteTemplate = async (id: string) => {
        if(!window.confirm("Are you sure? This could affect courses using this template.")) return;
        await remove(ref(db, `settings/assessmentTemplates/${id}`));
        toast({ title: 'Template deleted' });
    }

    return (
        <>
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Continuous Assessment Setup</CardTitle>
                    <CardDescription>Define CA structures and component weights. These templates can then be assigned to courses.</CardDescription>
                </div>
                <Button onClick={() => openDialog(null)}><PlusCircle className="mr-2 h-4 w-4"/>New Assessment Template</Button>
            </CardHeader>
            <CardContent>
                 {loading ? <Skeleton className="h-48" /> : templates.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map(template => (
                             <Card key={template.id} className="flex flex-col">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <CardTitle>{template.name}</CardTitle>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(template)}><Pencil className="h-4 w-4"/></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteTemplate(template.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </div>
                                    </div>
                                    <CardDescription>{Object.keys(template.components).length} components</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                     <ul className="space-y-1 text-sm">
                                        {Object.values(template.components).map((comp, i) => (
                                            <li key={i} className="flex justify-between">
                                                <span className="text-muted-foreground">{comp.name}</span>
                                                <span className="font-semibold">{comp.weight}%</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <div className="w-full text-center text-sm font-bold border-t pt-2">Total: 100%</div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                 ) : (
                    <div className="text-center py-16 text-muted-foreground">No assessment templates created yet.</div>
                 )}
            </CardContent>
        </Card>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{editingTemplate ? 'Edit' : 'Create'} Assessment Template</DialogTitle>
                    <DialogDescription>Define the name and weighted components for this assessment structure.</DialogDescription>
                </DialogHeader>
                 <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="space-y-1">
                        <Label htmlFor="template-name">Template Name</Label>
                        <Input id="template-name" value={templateName} onChange={e => setTemplateName(e.target.value)} />
                    </div>
                    
                    <Label>Assessment Components</Label>
                    <div className="space-y-2">
                        {components.map(comp => (
                            <div key={comp.id} className="flex items-center gap-2 p-2 border rounded-md">
                                <div className="flex-grow space-y-1">
                                    <Label htmlFor={`name-${comp.id}`} className="text-xs">Component Name</Label>
                                    <Input id={`name-${comp.id}`} placeholder="e.g., Quiz 1" value={comp.name} onChange={e => handleComponentChange(comp.id, 'name', e.target.value)} />
                                </div>
                                <div className="space-y-1 w-24">
                                     <Label htmlFor={`weight-${comp.id}`} className="text-xs">Weight (%)</Label>
                                    <div className="relative">
                                        <Input id={`weight-${comp.id}`} type="number" placeholder="%" value={comp.weight} onChange={e => handleComponentChange(comp.id, 'weight', e.target.value)} className="pr-6"/>
                                        <Percent className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeComponent(comp.id)} className="self-end"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            </div>
                        ))}
                    </div>
                    <Button type="button" variant="outline" onClick={addComponent}><PlusCircle className="mr-2 h-4 w-4"/>Add Component</Button>
                    <Alert variant={totalWeight !== 100 ? 'destructive' : 'default'}>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Total Weight: {totalWeight}%</AlertTitle>
                        <AlertDescription>
                            The sum of all component weights must equal 100%.
                        </AlertDescription>
                    </Alert>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSaveTemplate} disabled={saving || totalWeight !== 100}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Template</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
