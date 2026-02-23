'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, Loader2, Save, X, GripVertical, Link as LinkIcon, Info, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { ref, get, set, push, serverTimestamp, update, onValue } from 'firebase/database';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from "@/components/ui/separator";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';


type Question = {
    id: string;
    text: string;
    type: 'multiple-choice' | 'short-answer';
    options?: { id: string; text: string; }[];
    correctAnswer?: string; // optionId for multiple-choice
};

type Section = {
    id: string;
    title: string;
    questions: Question[];
};

type Quiz = {
    title: string;
    description: string;
    startTime?: string;
    endTime?: string;
    isMultipleChoiceOnly: boolean;
    shuffleQuestions: boolean;
    questionsPerPage: number;
    sections: Section[];
    courseId?: string | null;
    semesterId?: string | null;
    courseIds?: string[];
    semesterIds?: string[];
    intakeIds?: string[];
    programmeIds?: string[];
    linkedComponentId?: string | null;
};

type Course = { id: string; name: string; code: string; assessmentTemplateId?: string; };
type Programme = { id: string; name: string; };
type Semester = { id: string; name: string; status: 'Open' | 'Closed' | 'Archived'; };

const SortableQuestionItem = ({ sectionId, question, index, updateQuestion, removeQuestion, updateOption, addOption, removeOption, setCorrectAnswer }: {
    sectionId: string;
    question: Question;
    index: number;
    updateQuestion: (sectionId: string, questionId: string, field: keyof Question, value: any) => void;
    removeQuestion: (sectionId: string, questionId: string) => void;
    updateOption: (sectionId: string, questionId: string, optionId: string, text: string) => void;
    addOption: (sectionId: string, questionId: string) => void;
    removeOption: (sectionId: string, questionId: string, optionId: string) => void;
    setCorrectAnswer: (sectionId: string, questionId: string, optionId: string) => void;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: question.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div ref={setNodeRef} style={style} className="p-4 border rounded-md bg-card space-y-2">
            <div className="flex gap-2">
                <button {...attributes} {...listeners} className="cursor-grab p-1"><GripVertical className="h-5 w-5 text-muted-foreground"/></button>
                <div className="flex-grow space-y-2">
                    <Textarea placeholder="Question Text" value={question.text} onChange={(e) => updateQuestion(sectionId, question.id, 'text', e.target.value)} />
                    <Select value={question.type} onValueChange={(value) => updateQuestion(sectionId, question.id, 'type', value as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                            <SelectItem value="short-answer">Short Answer</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeQuestion(sectionId, question.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
            </div>
            {question.type === 'multiple-choice' && (
                <div className="pl-8 space-y-2">
                    {question.options?.map(option => (
                        <div key={option.id} className="flex items-center gap-2">
                            <Checkbox checked={question.correctAnswer === option.id} onCheckedChange={() => setCorrectAnswer(sectionId, question.id, option.id)} />
                            <Input placeholder="Option text" value={option.text} onChange={(e) => updateOption(sectionId, question.id, option.id, e.target.value)} />
                            <Button variant="ghost" size="icon" onClick={() => removeOption(sectionId, question.id, option.id)}><X className="h-4 w-4"/></Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => addOption(sectionId, question.id)}>Add Option</Button>
                </div>
            )}
        </div>
    );
};

export default function QuizBuilder({ quizId }: { quizId?: string }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const [quiz, setQuiz] = React.useState<Quiz>({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
        isMultipleChoiceOnly: false,
        shuffleQuestions: true,
        questionsPerPage: 10,
        sections: [{ id: `section-${Date.now()}`, title: 'Section 1', questions: [] }],
        courseIds: [],
        intakeIds: [],
        programmeIds: [],
        linkedComponentId: null,
    });
    
    const [courses, setAllCourses] = React.useState<Course[]>([]);
    const [templates, setTemplates] = React.useState<Record<string, any>>({});
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        const fetchMetadata = async () => {
            setLoading(true);
            try {
                const [cSnap, tSnap] = await Promise.all([
                    get(ref(db, 'courses')),
                    get(ref(db, 'settings/assessmentTemplates'))
                ]);
                if (cSnap.exists()) setAllCourses(Object.entries(cSnap.val()).map(([id, d]:[string, any]) => ({ id, ...d })));
                if (tSnap.exists()) setTemplates(tSnap.val());

                if (quizId) {
                    const quizSnap = await get(ref(db, `quizzes/${quizId}`));
                    if (quizSnap.exists()) setQuiz(quizSnap.val());
                } else {
                    const cId = searchParams.get('courseId');
                    const iIds = searchParams.get('intakeIds')?.split(',') || [];
                    const pIds = searchParams.get('programmeIds')?.split(',') || [];
                    const lcId = searchParams.get('linkedComponentId');

                    setQuiz(prev => ({
                        ...prev,
                        courseId: cId, 
                        courseIds: cId ? [cId] : [],
                        intakeIds: iIds,
                        programmeIds: pIds,
                        linkedComponentId: lcId
                    }));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchMetadata();
    }, [quizId, searchParams]);

    const handleQuizChange = (field: keyof Quiz, value: any) => {
        setQuiz(prev => ({ ...prev, [field]: value }));
    };

    const addSection = () => {
        setQuiz(prev => ({
            ...prev,
            sections: [...prev.sections, { id: `section-${Date.now()}`, title: `Section ${prev.sections.length + 1}`, questions: [] }]
        }));
    };
    
    const updateSectionTitle = (sectionId: string, title: string) => {
        setQuiz(prev => ({
            ...prev,
            sections: prev.sections.map(s => s.id === sectionId ? { ...s, title } : s)
        }));
    };
    
    const removeSection = (sectionId: string) => {
        if(quiz.sections.length <= 1) { toast({variant: 'destructive', title: "Cannot remove the last section."}); return; }
        setQuiz(prev => ({
            ...prev,
            sections: prev.sections.filter(s => s.id !== sectionId)
        }));
    };

    const addQuestion = (sectionId: string) => {
        const newQuestion: Question = { id: `q-${Date.now()}`, text: '', type: 'multiple-choice', options: [{id: `opt-1`, text: ''}, {id: `opt-2`, text: ''}], correctAnswer: '' };
        setQuiz(prev => ({
            ...prev,
            sections: prev.sections.map(s => s.id === sectionId ? { ...s, questions: [...s.questions, newQuestion] } : s)
        }));
    };

    const removeQuestion = (sectionId: string, questionId: string) => {
         setQuiz(prev => ({
            ...prev,
            sections: prev.sections.map(s => s.id === sectionId ? { ...s, questions: s.questions.filter(q => q.id !== questionId) } : s)
        }));
    };

    const updateQuestion = (sectionId: string, questionId: string, field: keyof Question, value: any) => {
        setQuiz(prev => ({
            ...prev,
            sections: prev.sections.map(s => s.id === sectionId ? { ...s, questions: s.questions.map(q => q.id === questionId ? { ...q, [field]: value } : q) } : s)
        }));
    };
    
    const addOption = (sectionId: string, questionId: string) => {
        setQuiz(prev => ({
            ...prev,
            sections: prev.sections.map(s => s.id === sectionId ? {
                ...s, questions: s.questions.map(q => q.id === questionId ? {
                    ...q, options: [...(q.options || []), { id: `opt-${Date.now()}`, text: '' }]
                } : q)
            } : s)
        }));
    };
    
    const removeOption = (sectionId: string, questionId: string, optionId: string) => {
         setQuiz(prev => ({
            ...prev,
            sections: prev.sections.map(s => s.id === sectionId ? {
                ...s, questions: s.questions.map(q => q.id === questionId ? {
                    ...q, options: (q.options || []).filter(opt => opt.id !== optionId)
                } : q)
            } : s)
        }));
    };

    const updateOption = (sectionId: string, questionId: string, optionId: string, text: string) => {
        setQuiz(prev => ({
            ...prev,
            sections: prev.sections.map(s => s.id === sectionId ? {
                ...s, questions: s.questions.map(q => q.id === questionId ? {
                    ...q, options: (q.options || []).map(opt => opt.id === optionId ? { ...opt, text } : opt)
                } : q)
            } : s)
        }));
    };
    
    const setCorrectAnswer = (sectionId: string, questionId: string, optionId: string) => {
        setQuiz(prev => ({
            ...prev,
            sections: prev.sections.map(s => s.id === sectionId ? {
                ...s, questions: s.questions.map(q => q.id === questionId ? {
                    ...q, correctAnswer: q.correctAnswer === optionId ? '' : optionId
                } : q)
            } : s)
        }));
    };

    const handleSaveQuiz = async () => {
        if (!quiz.title.trim()) { toast({ variant: 'destructive', title: 'Title required' }); return; }
        setSaving(true);
        try {
            const finalRef = quizId ? ref(db, `quizzes/${quizId}`) : push(ref(db, 'quizzes'));
            await set(finalRef, { ...quiz, timestamp: serverTimestamp() });
            toast({ title: 'Quiz Saved' });
            router.push('/staff/quizzes');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        
        setQuiz(prev => {
            const newSections = [...prev.sections];
            const activeSectionIndex = newSections.findIndex(s => s.questions.some(q => q.id === active.id));
            const overSectionIndex = newSections.findIndex(s => s.questions.some(q => q.id === over.id) || s.id === over.id);

            if (activeSectionIndex === -1 || overSectionIndex === -1) return prev;
            
            const activeSection = newSections[activeSectionIndex];
            const activeQuestionIndex = activeSection.questions.findIndex(q => q.id === active.id);
            const [movedQuestion] = activeSection.questions.splice(activeQuestionIndex, 1);
            
            if (activeSectionIndex === overSectionIndex) {
                 const overQuestionIndex = activeSection.questions.findIndex(q => q.id === over.id);
                 activeSection.questions.splice(overQuestionIndex, 0, movedQuestion);
            } else {
                const overSection = newSections[overSectionIndex];
                const overQuestionIndex = overSection.questions.findIndex(q => q.id === over.id);
                if (overQuestionIndex !== -1) {
                    overSection.questions.splice(overQuestionIndex, 0, movedQuestion);
                } else {
                     overSection.questions.push(movedQuestion);
                }
            }
            return {...prev, sections: newSections};
        });
    };

    const linkedCourse = quiz.courseIds?.[0] ? courses.find(c => c.id === quiz.courseIds![0]) : null;
    const linkedComponent = linkedCourse?.assessmentTemplateId && quiz.linkedComponentId 
        ? templates[linkedCourse.assessmentTemplateId]?.components?.[quiz.linkedComponentId]
        : null;

    if (loading) return <div className="space-y-6"><Skeleton className="h-40 w-full" /><Skeleton className="h-96 w-full" /></div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl">{quizId ? 'Edit' : 'Create'} Automated Exam</CardTitle>
                        <CardDescription>Configure rules and link to curriculum assessments.</CardDescription>
                    </div>
                    {linkedComponent && (
                        <Badge className="bg-blue-600 hover:bg-blue-700 py-1.5 px-4 gap-2 text-white">
                            <LinkIcon className="h-3 w-3" />
                            Fulfills CA: {linkedComponent.name}
                        </Badge>
                    )}
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <Label>Quiz Title</Label>
                            <Input placeholder="e.g., Mid-Term Anatomy Exam" value={quiz.title} onChange={e => handleQuizChange('title', e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Course Information</Label>
                            <div className="h-10 px-3 flex items-center border rounded-md bg-muted text-sm font-bold">
                                {linkedCourse ? `${linkedCourse.code}: ${linkedCourse.name}` : 'Standalone Assessment'}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label>Instructions for Students</Label>
                        <Textarea placeholder="Explain rules, time limits, and guidelines..." value={quiz.description} onChange={e => handleQuizChange('description', e.target.value)} rows={3} />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1"><Label>Opening Date/Time</Label><Input type="datetime-local" value={quiz.startTime} onChange={e => handleQuizChange('startTime', e.target.value)}/></div>
                        <div className="space-y-1"><Label>Closing Date/Time</Label><Input type="datetime-local" value={quiz.endTime} onChange={e => handleQuizChange('endTime', e.target.value)}/></div>
                        <div className="space-y-1"><Label>Questions Per Page</Label><Input type="number" min="0" value={quiz.questionsPerPage} onChange={e => handleQuizChange('questionsPerPage', Number(e.target.value))}/><p className="text-[10px] text-muted-foreground italic">Set to 0 to show all at once.</p></div>
                    </div>
                    <div className="flex flex-wrap gap-6 p-4 border rounded-xl bg-primary/5">
                        <div className="flex items-center space-x-2"><Switch id="shuffle" checked={quiz.shuffleQuestions} onCheckedChange={c => handleQuizChange('shuffleQuestions', c)}/><Label htmlFor="shuffle" className="text-xs font-bold uppercase">Shuffle Questions</Label></div>
                        <div className="flex items-center space-x-2"><Switch id="mc-only" checked={quiz.isMultipleChoiceOnly} onCheckedChange={c => handleQuizChange('isMultipleChoiceOnly', c)}/><Label htmlFor="mc-only" className="text-xs font-bold uppercase">Auto-Grade (MCQ Only)</Label></div>
                    </div>
                </CardContent>
            </Card>

             <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="space-y-4">
                    {quiz.sections.map((section, sectionIndex) => (
                        <Card key={section.id}>
                            <CardHeader className="flex-row items-center justify-between border-b pb-4">
                                <div className="flex-1 flex items-center gap-2">
                                    <Badge variant="secondary" className="font-mono">{sectionIndex + 1}</Badge>
                                    <Input className="text-lg font-black border-none shadow-none focus-visible:ring-0 p-0" value={section.title} onChange={(e) => updateSectionTitle(section.id, e.target.value)} />
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeSection(section.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <SortableContext items={section.questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                                    {section.questions.map((question, qIndex) => (
                                        <SortableQuestionItem
                                            key={question.id}
                                            sectionId={section.id}
                                            question={question}
                                            index={qIndex}
                                            updateQuestion={updateQuestion}
                                            removeQuestion={removeQuestion}
                                            updateOption={updateOption}
                                            addOption={addOption}
                                            removeOption={removeOption}
                                            setCorrectAnswer={setCorrectAnswer}
                                        />
                                    ))}
                                </SortableContext>
                                <Button variant="outline" onClick={() => addQuestion(section.id)} className="w-full border-dashed border-2 py-8"><PlusCircle className="mr-2 h-4 w-4"/>Add Question to Section {sectionIndex + 1}</Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </DndContext>
            
            <div className="flex justify-between items-center bg-muted/20 p-6 border-t rounded-xl">
                <Button variant="secondary" onClick={addSection} className="shadow-sm"><PlusCircle className="mr-2 h-4 w-4"/>Add New Section</Button>
                <Button size="lg" onClick={handleSaveQuiz} disabled={saving} className="shadow-lg px-12 font-bold">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4 mr-2" />}
                    Save & Publish Quiz
                </Button>
            </div>
        </div>
    );
}