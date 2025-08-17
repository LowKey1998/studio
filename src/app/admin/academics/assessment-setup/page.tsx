
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2, Percent, AlertCircle } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
                await push(ref(db, `settings/assessmentTemplates`), templateData);
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
                <Button onClick={() => openDialog(null)}><PlusCircle className="mr-2 h-4"/>New Assessment Template</Button>
            </CardHeader>
            <CardContent>
                 {loading ? <Skeleton className="h-48" /> : templates.length > 0 ? (
                    <Accordion type="multiple" className="w-full space-y-2">
                        {templates.map(template => (
                             <AccordionItem value={template.id} key={template.id} className="border rounded-md px-4">
                                <AccordionTrigger className="hover:no-underline">
                                    <div className="flex-1 text-left">
                                        <p className="font-bold">{template.name}</p>
                                        <p className="text-sm text-muted-foreground">{Object.keys(template.components).length} components</p>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <ul className="list-disc pl-5 text-muted-foreground">
                                        {Object.values(template.components).map((comp, i) => (
                                            <li key={i}>{comp.name} ({comp.weight}%)</li>
                                        ))}
                                    </ul>
                                     <div className="flex justify-end gap-2 mt-4">
                                        <Button variant="outline" size="sm" onClick={() => openDialog(template)}>Edit</Button>
                                        <Button variant="destructive" size="sm" onClick={() => handleDeleteTemplate(template.id)}>Delete</Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                 ) : (
                    <div className="text-center py-16 text-muted-foreground">No assessment templates created yet.</div>
                 )}
            </CardContent>
        </Card>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{editingTemplate ? 'Edit' : 'Create'} Assessment Template</DialogTitle>
                </DialogHeader>
                 <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="space-y-1">
                        <Label htmlFor="template-name">Template Name</Label>
                        <Input id="template-name" value={templateName} onChange={e => setTemplateName(e.target.value)} />
                    </div>
                    
                    <Label>Assessment Components</Label>
                    <div className="space-y-2">
                        {components.map(comp => (
                            <div key={comp.id} className="flex items-center gap-2">
                                <Input placeholder="Component Name (e.g., Quiz 1)" value={comp.name} onChange={e => handleComponentChange(comp.id, 'name', e.target.value)} />
                                <div className="relative">
                                    <Input type="number" placeholder="Weight" value={comp.weight} onChange={e => handleComponentChange(comp.id, 'weight', e.target.value)} className="w-24 pr-6"/>
                                    <Percent className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeComponent(comp.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
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
                    <Button onClick={handleSaveTemplate} disabled={saving || totalWeight !== 100}>{saving && <Loader2 className="mr-2"/>}Save Template</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
