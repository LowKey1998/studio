'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2, Percent, AlertCircle, Pencil, Link as LinkIcon, Search, Check, X, BookOpen } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, update, get } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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

type Course = {
    id: string;
    name: string;
    code: string;
    assessmentTemplateId?: string;
};

export default function AssessmentSetupPage() {
    const [templates, setTemplates] = React.useState<AssessmentTemplate[]>([]);
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Template Edit State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<AssessmentTemplate | null>(null);
    const [templateName, setTemplateName] = React.useState('');
    const [components, setComponents] = React.useState<AssessmentComponent[]>([]);

    // Linking State
    const [isLinkDialogOpen, setIsLinkDialogOpen] = React.useState(false);
    const [linkingTemplate, setLinkingTemplate] = React.useState<AssessmentTemplate | null>(null);
    const [selectedCourseIds, setSelectedCourseIds] = React.useState<string[]>([]);
    const [courseSearch, setCourseSearch] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const templatesRef = ref(db, 'settings/assessmentTemplates');
        const coursesRef = ref(db, 'courses');

        const unsubTemplates = onValue(templatesRef, (snapshot) => {
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
        });

        const unsubCourses = onValue(coursesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setCourses(Object.keys(data).map(id => ({ id, ...data[id] })).filter(c => c.status !== 'archived'));
            } else {
                setCourses([]);
            }
            setLoading(false);
        });

        return () => {
            unsubTemplates();
            unsubCourses();
        };
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
        if(!window.confirm("Are you sure? This will remove the template and unassign it from all courses.")) return;
        
        try {
            const updates: Record<string, any> = {};
            updates[`settings/assessmentTemplates/${id}`] = null;
            courses.forEach(c => {
                if (c.assessmentTemplateId === id) {
                    updates[`courses/${c.id}/assessmentTemplateId`] = null;
                }
            });
            await update(ref(db), updates);
            toast({ title: 'Template deleted' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Deletion failed' });
        }
    }

    const openLinkDialog = (template: AssessmentTemplate) => {
        setLinkingTemplate(template);
        setSelectedCourseIds(courses.filter(c => c.assessmentTemplateId === template.id).map(c => c.id));
        setCourseSearch('');
        setIsLinkDialogOpen(true);
    };

    const handleSaveLinking = async () => {
        if (!linkingTemplate) return;
        setSaving(true);
        try {
            const updates: Record<string, any> = {};
            
            // 1. Unassign this template from all courses that currently have it but aren't in the new selection
            courses.forEach(c => {
                if (c.assessmentTemplateId === linkingTemplate.id && !selectedCourseIds.includes(c.id)) {
                    updates[`courses/${c.id}/assessmentTemplateId`] = null;
                }
            });

            // 2. Assign this template to all courses in the new selection
            selectedCourseIds.forEach(cid => {
                updates[`courses/${cid}/assessmentTemplateId`] = linkingTemplate.id;
            });

            await update(ref(db), updates);
            toast({ title: "Linking Updated", description: `${selectedCourseIds.length} course(s) are now linked to this template.` });
            setIsLinkDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Update Failed", description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const filteredCourses = courses.filter(c => 
        c.name.toLowerCase().includes(courseSearch.toLowerCase()) || 
        c.code.toLowerCase().includes(courseSearch.toLowerCase())
    );

    const toggleCourseSelection = (id: string) => {
        setSelectedCourseIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    return (
        <div className="space-y-6">
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
                            {templates.map(template => {
                                const linkedCount = courses.filter(c => c.assessmentTemplateId === template.id).length;
                                return (
                                <Card key={template.id} className="flex flex-col border-t-4 border-t-primary">
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg">{template.name}</CardTitle>
                                                <CardDescription>{Object.keys(template.components).length} components</CardDescription>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(template)}><Pencil className="h-4 w-4"/></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteTemplate(template.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <ul className="space-y-1 text-sm border-b pb-4 mb-4">
                                            {Object.values(template.components).map((comp, i) => (
                                                <li key={i} className="flex justify-between">
                                                    <span className="text-muted-foreground">{comp.name}</span>
                                                    <span className="font-semibold">{comp.weight}%</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="flex items-center justify-between text-xs font-medium">
                                            <span className="text-muted-foreground">Linked Courses:</span>
                                            <Badge variant="secondary">{linkedCount}</Badge>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="pt-0">
                                        <Button variant="outline" className="w-full" onClick={() => openLinkDialog(template)}>
                                            <LinkIcon className="mr-2 h-4 w-4"/>
                                            Link Courses
                                        </Button>
                                    </CardFooter>
                                </Card>
                            )})}
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
                            <Input id="template-name" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g., General Nursing CA" />
                        </div>
                        
                        <Label>Assessment Components</Label>
                        <div className="space-y-2">
                            {components.map(comp => (
                                <div key={comp.id} className="flex items-center gap-2 p-3 border rounded-md bg-muted/20 shadow-sm">
                                    <div className="flex-grow space-y-1">
                                        <Label htmlFor={`name-${comp.id}`} className="text-[10px] uppercase font-bold text-muted-foreground">Component Name</Label>
                                        <Input id={`name-${comp.id}`} placeholder="e.g., Quiz 1" value={comp.name} onChange={e => handleComponentChange(comp.id, 'name', e.target.value)} />
                                    </div>
                                    <div className="space-y-1 w-24">
                                        <Label htmlFor={`weight-${comp.id}`} className="text-[10px] uppercase font-bold text-muted-foreground">Weight (%)</Label>
                                        <div className="relative">
                                            <Input id={`weight-${comp.id}`} type="number" placeholder="%" value={comp.weight} onChange={e => handleComponentChange(comp.id, 'weight', e.target.value)} className="pr-6"/>
                                            <Percent className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => removeComponent(comp.id)} className="self-end mb-0.5"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </div>
                            ))}
                        </div>
                        <Button type="button" variant="outline" onClick={addComponent} className="border-dashed"><PlusCircle className="mr-2 h-4 w-4"/>Add Component</Button>
                        <Alert variant={totalWeight !== 100 ? 'destructive' : 'default'} className="bg-muted/30">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle className="text-xs font-bold uppercase">Structure Status: {totalWeight}%</AlertTitle>
                            <AlertDescription className="text-xs">
                                The sum of all component weights must equal 100% to save.
                            </AlertDescription>
                        </Alert>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleSaveTemplate} disabled={saving || totalWeight !== 100}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Template</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Link Template: {linkingTemplate?.name}</DialogTitle>
                        <DialogDescription>Assign this assessment structure to multiple courses at once. Search and select from the roster below.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4 flex-1 overflow-hidden">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search course by name or code..." className="pl-8" value={courseSearch} onChange={e => setCourseSearch(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2 px-1">
                            <Badge variant="secondary" className="text-[10px] font-bold uppercase">{selectedCourseIds.length} Courses Selected</Badge>
                            <Separator orientation="vertical" className="h-4 mx-2" />
                            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setSelectedCourseIds([])}>Clear All</Button>
                        </div>
                        <ScrollArea className="flex-1 rounded-md border bg-muted/10 p-2">
                            <div className="space-y-1">
                                {filteredCourses.map(course => (
                                    <div 
                                        key={course.id} 
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-md transition-all cursor-pointer",
                                            selectedCourseIds.includes(course.id) ? "bg-primary/10 border-primary/20" : "hover:bg-accent border-transparent"
                                        )}
                                        onClick={() => toggleCourseSelection(course.id)}
                                    >
                                        <Checkbox checked={selectedCourseIds.includes(course.id)} />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold leading-none">{course.name}</p>
                                            <p className="text-xs text-muted-foreground mt-1 font-mono">{course.code}</p>
                                        </div>
                                        {course.assessmentTemplateId && course.assessmentTemplateId !== linkingTemplate?.id && (
                                            <Badge variant="outline" className="text-[10px] opacity-50">Already Overrides Other Template</Badge>
                                        )}
                                    </div>
                                ))}
                                {filteredCourses.length === 0 && (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <BookOpen className="mx-auto h-8 w-8 mb-2 opacity-20"/>
                                        <p className="text-sm">No courses matching your search.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveLinking} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                            Update Assignments
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
