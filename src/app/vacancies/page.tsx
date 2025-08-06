
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { format } from 'date-fns';
import Logo from '@/components/logo';
import Link from 'next/link';
import { Briefcase, Clock, ArrowRight } from 'lucide-react';

type Vacancy = {
    id: string;
    title: string;
    department: string;
    type: 'Full-time' | 'Part-time' | 'Contract';
    status: 'Open' | 'Closed';
    datePosted: string;
};

export default function VacanciesPage() {
    const [vacancies, setVacancies] = React.useState<Vacancy[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const vacanciesRef = ref(db, 'vacancies');
        const unsubscribe = onValue(vacanciesRef, (snapshot) => {
            const openVacancies: Vacancy[] = [];
            if (snapshot.exists()) {
                const data = snapshot.val();
                Object.keys(data).forEach(key => {
                    if (data[key].status === 'Open') {
                        openVacancies.push({ ...data[key], id: key });
                    }
                });
            }
            setVacancies(openVacancies.sort((a,b) => new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime()));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
         <div className="min-h-screen bg-muted/40">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center">
                    <Logo />
                </div>
            </header>
            <main className="container py-12">
                <div className="max-w-4xl mx-auto text-center mb-12">
                    <h1 className="font-headline text-4xl md:text-5xl font-bold">Join Our Team</h1>
                    <p className="text-lg text-muted-foreground mt-4">We're looking for passionate individuals to help us shape the future of education. Check out our open positions below.</p>
                </div>
                 {loading ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-56 w-full"/>)}
                    </div>
                ) : vacancies.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {vacancies.map(v => (
                            <Card key={v.id} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle>{v.title}</CardTitle>
                                    <CardDescription>Posted on {format(new Date(v.datePosted), 'PPP')}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow space-y-2">
                                     <div className="flex items-center gap-2 text-sm text-muted-foreground"><Briefcase className="h-4 w-4"/> {v.department}</div>
                                     <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4"/> {v.type}</div>
                                </CardContent>
                                <CardFooter>
                                    <Button asChild className="w-full"><Link href={`/vacancies/${v.id}`}>View & Apply <ArrowRight className="ml-2 h-4 w-4"/></Link></Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card><CardContent className="py-16 text-center text-muted-foreground">
                        <p>There are currently no open vacancies. Please check back later.</p>
                    </CardContent></Card>
                )}
            </main>
        </div>
    );
}

