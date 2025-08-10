
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash2, Loader2, Save, X, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { ref, get, set, push, serverTimestamp, update, remove } from 'firebase/database';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from './ui/checkbox';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import { Skeleton } from './ui/skeleton';

type Question = {
    id: string;
    text: string;
    type: 'multiple-choice' | 'short-answer';
    options?: { id: string; text: string; }[];
    correctAnswer?: string; // option id for multiple-choice
};

type Section = {
    id: string;
    title: string;
    questions: Question[];
};

type Quiz = {
    title: string;
    description: string;
    timeLimit: number; // in minutes
    startTime?: string;
    isMultipleChoiceOnly: boolean;
    shuffleQuestions: boolean;
    sections: Section[];
    courseId: string | null;
    semesterId: string | null;
};

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
                    <Select value={question.type} onValueChange={(value) => updateQuestion(sectionId, question.id, 'type', value)}>
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

export default function QuizBuilder({ quizId, courseId, semesterId }: { quizId?: string, courseId?: string | null, semesterId?: string | null }) {
    const [quiz, setQuiz] = React.useState<Quiz>({
        title: '',
        description: '',
        timeLimit: 30,
        startTime: '',
        isMultipleChoiceOnly: false,
        shuffleQuestions: true,
        sections: [{ id: `section-${Date.now()}`, title: 'Section 1', questions: [] }],
        courseId: courseId || null,
        semesterId: semesterId || null,
    });
    const [course, setCourse] = React.useState<{ name: string; code: string } | null>(null);
    const [semester, setSemester] = React.useState<{ name: string } | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    React.useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                if (quizId) {
                    const quizRef = ref(db, `quizzes/${quizId}`);
                    const snapshot = await get(quizRef);
                    if (snapshot.exists()) {
                        const quizData = snapshot.val();
                        setQuiz(quizData);
                        if (quizData.courseId) {
                            const courseRef = ref(db, `courses/${quizData.courseId}`);
                            const courseSnap = await get(courseRef);
                            if (courseSnap.exists()) setCourse(courseSnap.val());
                        }
                         if (quizData.semesterId) {
                            const semesterRef = ref(db, `semesters/${quizData.semesterId}`);
                            const semesterSnap = await get(semesterRef);
                            if (semesterSnap.exists()) setSemester(semesterSnap.val());
                        }
                    } else {
                        toast({ variant: 'destructive', title: 'Quiz not found' });
                    }
                } else if (courseId && semesterId) {
                     const courseRef = ref(db, `courses/${courseId}`);
                     const semesterRef = ref(db, `semesters/${semesterId}`);
                     const [courseSnap, semesterSnap] = await Promise.all([get(courseRef), get(semesterRef)]);
                     if(courseSnap.exists()) setCourse(courseSnap.val());
                     if(semesterSnap.exists()) setSemester(semesterSnap.val());
                }
            } catch (error) {
                 toast({ variant: 'destructive', title: 'Error loading details' });
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [quizId, courseId, semesterId, toast]);

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
        if(quiz.sections.length <= 1) { toast({variant: 'destructive', title: "Cannot remove the last section."}); return;}
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
        setSaving(true);
        try {
            const quizToSave = {...quiz};
            if(!quizId && courseId) {
                quizToSave.courseId = courseId;
            }
            if(!quizId && semesterId) {
                quizToSave.semesterId = semesterId;
            }

            const quizRef = quizId ? ref(db, `quizzes/${quizId}`) : push(ref(db, 'quizzes'));
            await set(quizRef, quizToSave);
            toast({ title: 'Quiz Saved', description: 'Your quiz has been successfully saved.' });
            router.push('/admin/e-learning/online-quizzes');
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

    if (loading) {
        return (
            <div className="space-y-6">
                 <Skeleton className="h-40 w-full" />
                 <Skeleton className="h-64 w-full" />
                 <div className="flex justify-end"><Skeleton className="h-10 w-24" /></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">{quizId ? 'Edit Quiz' : 'Create New Quiz'}</CardTitle>
                    <CardDescription>
                        {loading ? <Skeleton className="h-4 w-1/2" /> :
                        `For ${course?.name || '...'} (${course?.code || '...'}) - ${semester?.name || '...'}.`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input placeholder="Quiz Title" value={quiz.title} onChange={e => handleQuizChange('title', e.target.value)} />
                    <Textarea placeholder="Quiz Description" value={quiz.description} onChange={e => handleQuizChange('description', e.target.value)} />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div><Label>Start Time</Label><Input type="datetime-local" value={quiz.startTime} onChange={e => handleQuizChange('startTime', e.target.value)}/></div>
                        <div><Label>Time Limit (minutes)</Label><Input type="number" value={quiz.timeLimit} onChange={e => handleQuizChange('timeLimit', Number(e.target.value))}/></div>
                        <div className="flex items-end gap-4">
                            <div className="flex items-center space-x-2"><Switch id="shuffle" checked={quiz.shuffleQuestions} onCheckedChange={c => handleQuizChange('shuffleQuestions', c)}/><Label htmlFor="shuffle">Shuffle Questions</Label></div>
                            <div className="flex items-center space-x-2"><Switch id="mc-only" checked={quiz.isMultipleChoiceOnly} onCheckedChange={c => handleQuizChange('isMultipleChoiceOnly', c)}/><Label htmlFor="mc-only">Auto-Grade</Label></div>
                        </div>
                    </div>
                </CardContent>
            </Card>

             <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="space-y-4">
                    {quiz.sections.map((section, sectionIndex) => (
                        <Card key={section.id}>
                            <CardHeader className="flex-row items-center justify-between">
                                <Input className="text-lg font-bold border-none shadow-none focus-visible:ring-0 p-0" value={section.title} onChange={(e) => updateSectionTitle(section.id, e.target.value)} />
                                <Button variant="ghost" size="icon" onClick={() => removeSection(section.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
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
                                <Button variant="outline" onClick={() => addQuestion(section.id)}><PlusCircle className="mr-2 h-4 w-4"/>Add Question</Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </DndContext>
            
            <div className="flex justify-between">
                <Button variant="secondary" onClick={addSection}><PlusCircle className="mr-2 h-4 w-4"/>Add Section</Button>
                <Button onClick={handleSaveQuiz} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}Save Quiz</Button>
            </div>
        </div>
    );
}
