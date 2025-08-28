
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { UserCheck, Info } from 'lucide-react';
import Confetti from 'react-confetti';

type OnboardingTask = {
    id: string;
    text: string;
};

type OnboardingTemplate = {
    id: string;
    name: string;
    tasks: Record<string, { text: string }>;
};

export default function StaffOnboardingPage() {
    const { user, userProfile } = useAuth();
    const [template, setTemplate] = React.useState<OnboardingTemplate | null>(null);
    const [completedTasks, setCompletedTasks] = React.useState<Record<string, boolean>>({});
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!userProfile || !userProfile.onboardingStatus) {
            setLoading(false);
            return;
        }

        const { templateId, completedTasks: initialCompleted } = userProfile.onboardingStatus;
        setCompletedTasks(initialCompleted || {});

        const templateRef = ref(db, `onboardingTemplates/${templateId}`);
        const unsub = onValue(templateRef, (snapshot) => {
            if (snapshot.exists()) {
                setTemplate({ id: snapshot.key, ...snapshot.val() });
            }
            setLoading(false);
        });

        return () => unsub();

    }, [userProfile]);

    const handleTaskToggle = async (taskId: string) => {
        if (!user || !template) return;
        
        const newCompletedTasks = { ...completedTasks };
        if (newCompletedTasks[taskId]) {
            delete newCompletedTasks[taskId];
        } else {
            newCompletedTasks[taskId] = true;
        }
        
        setCompletedTasks(newCompletedTasks);
        
        const totalTasks = Object.keys(template.tasks || {}).length;
        const completedCount = Object.keys(newCompletedTasks).length;
        const progress = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;
        
        await update(ref(db, `users/${user.uid}/onboardingStatus`), {
            completedTasks: newCompletedTasks,
            progress: progress,
        });
    };
    
    if (loading) {
        return <Skeleton className="h-96 w-full" />;
    }

    if (!userProfile?.onboardingStatus || !template) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Welcome!</CardTitle>
                </CardHeader>
                <CardContent>
                     <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>No Onboarding Checklist Found</AlertTitle>
                        <AlertDescription>
                           Your onboarding checklist has not been assigned yet. Please contact HR.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }
    
    const tasks = Object.entries(template.tasks || {}).map(([id, task]) => ({ id, ...task }));
    const progress = userProfile.onboardingStatus.progress || 0;
    const isComplete = progress >= 100;

    return (
        <Card className="relative overflow-hidden">
            {isComplete && <Confetti recycle={false}/>}
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Onboarding Checklist: {template.name}</CardTitle>
                <CardDescription>Welcome! Please complete the following tasks to finish your onboarding process.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Progress value={progress} className="w-full" />
                        <span className="font-bold text-lg">{progress.toFixed(0)}%</span>
                    </div>
                     {isComplete && (
                        <Alert className="bg-green-50 border-green-200">
                            <UserCheck className="h-4 w-4 text-green-700" />
                            <AlertTitle className="text-green-800">Onboarding Complete!</AlertTitle>
                            <AlertDescription className="text-green-700">
                               Congratulations and welcome to the team! You have completed all your onboarding tasks.
                            </AlertDescription>
                        </Alert>
                    )}
                    <div className="space-y-3 pt-4">
                        {tasks.map((task) => (
                            <div key={task.id} className="flex items-center space-x-3 p-3 rounded-md border bg-background hover:bg-accent/50 transition-colors">
                                <Checkbox 
                                    id={task.id} 
                                    checked={!!completedTasks[task.id]} 
                                    onCheckedChange={() => handleTaskToggle(task.id)}
                                />
                                <Label 
                                    htmlFor={task.id} 
                                    className={`flex-1 text-sm font-medium ${completedTasks[task.id] ? 'text-muted-foreground line-through' : ''}`}
                                >
                                    {task.text}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
