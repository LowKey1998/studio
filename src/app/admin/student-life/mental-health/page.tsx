
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, PlusCircle, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

type CounselingLog = {
    id: string;
    date: string;
    studentId: string;
    studentName: string;
    notes: string;
    counselorId: string;
};

type UserData = {
    role: 'Admin' | 'Staff';
    subRoles?: string[];
}

export default function MentalHealthPage() {
    const [logs, setLogs] = React.useState<CounselingLog[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            setCurrentUser(user);
             const userRef = ref(db, `users/${user.uid}`);
            onValue(userRef, snapshot => setUserData(snapshot.val()));
          } else {
            setLoading(false);
          }
        });
        return () => unsubscribe();
    }, []);

    const isCounselor = React.useMemo(() => userData?.subRoles?.includes('Counselor') || userData?.role === 'Admin', [userData]);

    React.useEffect(() => {
        if (!isCounselor) {
            setLoading(false);
            return;
        }
        const logsRef = ref(db, 'counselingLogs');
        const unsubscribe = onValue(logsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setLogs(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.date.localeCompare(a.date)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [isCounselor]);

    if(loading) return <Skeleton className="h-48"/>

    if (!isCounselor) {
        return (
             <Card>
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>This page is restricted to authorized counseling staff only.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Mental Health Logs</CardTitle>
                <CardDescription>Securely manage confidential mental health and counseling notes.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Alert variant="destructive" className="mb-4">
                    <Shield className="h-4 w-4" />
                    <AlertTitle>Strictly Confidential</AlertTitle>
                    <AlertDescription>
                        This section contains highly sensitive information. All actions are logged.
                    </AlertDescription>
                </Alert>
                 <div className="text-center py-16 text-muted-foreground">
                    <p>This feature is under development to ensure maximum security and compliance.</p>
                </div>
            </CardContent>
        </Card>
    );
}
