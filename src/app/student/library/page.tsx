
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, BookCheck, BookX, Loader2, Library, BookUp } from "lucide-react";
import Image from 'next/image';
import { db, auth, createNotification } from '@/lib/firebase';
import { ref, get, onValue, serverTimestamp, update, push, remove } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type Book = {
    id: string;
    title: string;
    author: string;
    genre: string;
    status: 'Available' | 'Checked Out' | 'Requested';
    image: string;
    hint: string;
    barcode?: string;
    requesterId?: string;
    year?: number;
    count?: number;
};

type UserData = {
    name: string;
    role: 'Student' | 'Staff' | 'Admin';
    subRoles?: string[];
};

const statusConfig: { [key in Book['status']]: { variant: 'default' | 'secondary' | 'destructive', icon: React.ReactNode } } = {
  "Available": { variant: 'default', icon: <BookCheck className="mr-1 h-4 w-4" /> },
  "Checked Out": { variant: 'secondary', icon: <BookX className="mr-1 h-4 w-4" /> },
  "Requested": { variant: 'destructive', icon: <BookUp className="mr-1 h-4 w-4" /> },
};

export default function LibraryPage() {
    const [books, setBooks] = React.useState<Book[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);
    const [bookRequests, setBookRequests] = React.useState<Record<string, any>>({});
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setCurrentUser(user);
            const userRef = ref(db, `users/${user.uid}`);
            onValue(userRef, (snapshot) => {
                if (snapshot.exists()) setUserData(snapshot.val());
            });
            const requestsRef = ref(db, 'bookRequests');
            onValue(requestsRef, (snapshot) => {
                if (snapshot.exists()) setBookRequests(snapshot.val());
            })
          }
        });
        return () => unsubscribeAuth();
      }, []);

    React.useEffect(() => {
        setLoading(true);
        const booksRef = ref(db, 'libraryBooks');
        const unsubscribe = onValue(booksRef, (snapshot) => {
            if (snapshot.exists()) {
                const booksData = snapshot.val();
                const booksList: Book[] = Object.keys(booksData).map(key => ({
                    id: key,
                    ...booksData[key],
                    hint: "book cover", // default hint
                }));
                setBooks(booksList.reverse());
            } else {
                setBooks([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);
    
    
    const handleRequestBook = async (book: Book) => {
        if (!currentUser || !userData) {
            toast({ variant: 'destructive', title: 'Not signed in', description: 'You must be signed in to request a book.' });
            return;
        }

        const isAvailable = (book.count || 0) > 0 && book.status === 'Available';
        if (!isAvailable) {
            toast({ variant: 'destructive', title: 'Book Unavailable', description: 'This book cannot be requested at this time.' });
            return;
        }

        try {
            const updates: Record<string, any> = {};
            const requestRef = push(ref(db, 'bookRequests'));
            updates[`bookRequests/${requestRef.key}`] = {
                bookId: book.id,
                bookTitle: book.title,
                userId: currentUser.uid,
                userName: userData.name,
                requestDate: new Date().toISOString(),
                status: 'Pending',
            };
            updates[`libraryBooks/${book.id}/status`] = 'Requested';
            updates[`libraryBooks/${book.id}/requesterId`] = currentUser.uid;
            
            await update(ref(db), updates);

            toast({ title: 'Request Sent', description: `Your request for "${book.title}" has been sent to the librarian.` });
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Request Failed', description: error.message });
        }
    };

    const handleCancelRequest = async (book: Book) => {
        if (!currentUser) return;
        
        const requestId = Object.keys(bookRequests).find(key => bookRequests[key].bookId === book.id && bookRequests[key].userId === currentUser.uid && bookRequests[key].status === 'Pending');
        if (!requestId) {
            toast({ variant: 'destructive', title: 'Could not find request to cancel.'});
            return;
        }

        try {
            const updates: Record<string, any> = {};
            updates[`bookRequests/${requestId}`] = null;
            updates[`libraryBooks/${book.id}/status`] = 'Available';
            updates[`libraryBooks/${book.id}/requesterId`] = null;

            await update(ref(db), updates);
            toast({ title: 'Request Canceled', description: 'Your book request has been canceled.'});
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Cancellation failed', description: error.message });
        }
    };


    const filteredBooks = books.filter(book => 
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.genre.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return (
        <div className="space-y-6">
        <Card className="shadow-lg border-0">
            <CardHeader>
                <div>
                    <CardTitle className="font-headline text-2xl">Library Catalog</CardTitle>
                    <CardDescription>Browse and search for books available in the library.</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
            <div className="relative w-full max-w-xl">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                placeholder="Search by title, author, or genre..." 
                className="pl-8" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            </CardContent>
        </Card>

        {loading ? (
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                 {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
            </div>
        ) : filteredBooks.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBooks.map((book) => {
                const isAvailable = (book.count || 0) > 0 && book.status === 'Available';
                const hasRequested = book.requesterId === currentUser?.uid && book.status === 'Requested';
                
                return (
                    <Card key={book.id} className="flex flex-col overflow-hidden shadow-lg transition-transform duration-300 hover:-translate-y-1">
                        <CardHeader className="p-0">
                            <div className="relative h-48 w-full">
                                <Image src={book.image} alt={`Cover of ${book.title}`} layout="fill" objectFit="cover" data-ai-hint={book.hint} />
                            </div>
                            <div className="p-4">
                                <CardTitle className="font-headline text-lg leading-tight">{book.title}</CardTitle>
                                <CardDescription>by {book.author}</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-grow flex-col gap-2 p-4 pt-0">
                            <div className="flex flex-wrap gap-2">
                                {book.genre && <Badge variant="outline">{book.genre}</Badge>}
                                {book.year && <Badge variant="outline">Year: {book.year}</Badge>}
                            </div>
                            {book.count && <p className="text-sm text-muted-foreground">Copies Available: {book.status === 'Available' ? (book.count || 0) : 0}</p>}
                        </CardContent>
                        <CardFooter className="flex justify-between items-center bg-muted/50 p-4">
                            <Badge variant={statusConfig[book.status].variant} className="flex items-center">
                                {statusConfig[book.status].icon}
                                {book.status}
                            </Badge>
                            {hasRequested ? (
                                <Button variant="destructive" size="sm" onClick={() => handleCancelRequest(book)}>Cancel Request</Button>
                            ) : (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    disabled={!isAvailable}
                                    onClick={() => handleRequestBook(book)}
                                >
                                    {isAvailable ? 'Request' : 'Unavailable'}
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                )
            })}
            </div>
        ) : (
             <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                    <Library className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No Books Found</h3>
                    <p className="mt-2 text-sm">
                        There are no books in the library catalog yet. Check back soon!
                    </p>
                </CardContent>
            </Card>
        )}
        </div>
    );
}
