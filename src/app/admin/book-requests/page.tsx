
'use client'
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, CalendarIcon, Barcode, UserCheck, Check, X, History, User, Clock, BookCheck, BookX, Search, Info, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as AuthUser } from 'firebase/auth';
import { auth, db, createNotification } from '@/lib/firebase';
import { ref, update, onValue, get, set, push, remove, runTransaction } from 'firebase/database';
import { format, addDays } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type BookRequest = {
  id: string;
  bookId: string;
  bookTitle: string;
  userId: string;
  userName: string;
  requestDate: string;
  status: 'Pending' | 'Checked Out' | 'Returned' | 'Declined';
  dueDate?: string;
  checkoutDate?: string;
};

type LibraryBook = {
    id: string;
    title: string;
    barcode?: string;
    status: 'Available' | 'Checked Out' | 'Requested';
};

type AppUser = {
    uid: string;
    id: string; // system ID
    name: string;
};

type UserData = {
    role: 'Admin' | 'Staff' | 'Student';
    subRoles?: string[];
}

const BOOK_SCANNER_REGION_ID = "book-barcode-scanner-region";
const USER_SCANNER_REGION_ID = "user-barcode-scanner-region";

export default function BookRequestsPage() {
    const [requests, setRequests] = React.useState<BookRequest[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);
    const [activeTab, setActiveTab] = React.useState('pending');

    const [checkoutRequestId, setCheckoutRequestId] = React.useState<string | null>(null);
    const [returnDate, setReturnDate] = React.useState<Date | undefined>();
    const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = React.useState(false);
    
    const [isDirectCheckoutOpen, setIsDirectCheckoutOpen] = React.useState(false);
    const [allBooks, setAllBooks] = React.useState<LibraryBook[]>([]);
    const [allUsers, setAllUsers] = React.useState<AppUser[]>([]);
    const [selectedBook, setSelectedBook] = React.useState('');
    const [selectedUser, setSelectedUser] = React.useState('');
    const [directCheckoutDate, setDirectCheckoutDate] = React.useState<Date | undefined>();
    const [userSearch, setUserSearch] = React.useState('');
    
    const [isBookScannerActive, setIsBookScannerActive] = React.useState(false);
    const [isUserScannerActive, setIsUserScannerActive] = React.useState(false);
    
    const [bookScanner, setBookScanner] = React.useState<Html5Qrcode | null>(null);
    const [userScanner, setUserScanner] = React.useState<Html5Qrcode | null>(null);

    const [scannerError, setScannerError] = React.useState<string | null>(null);

    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if(user) {
                setCurrentUser(user);
                 const userRef = ref(db, `users/${user.uid}`);
                const userUnsub = onValue(userRef, (snapshot) => {
                    if (snapshot.exists()) {
                        setUserData(snapshot.val());
                    } else {
                        setUserData(null);
                    }
                });
                return () => userUnsub();
            } else {
                 setCurrentUser(null);
                 setUserData(null);
            }
        });
        return () => unsubscribe();
    }, []);
    
    const fetchAllData = React.useCallback(async () => {
        // No need to set loading here as the main useEffect does it.
        try {
            const [usersSnap, booksSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'libraryBooks'))
            ]);

            if (usersSnap.exists()) {
                const usersData = usersSnap.val();
                setAllUsers(Object.keys(usersData).map(uid => ({ uid, ...usersData[uid] })));
            }
            if (booksSnap.exists()) {
                const booksData = booksSnap.val();
                setAllBooks(Object.keys(booksData).map(id => ({ id, ...booksData[id] })));
            }
        } catch(e) { console.error(e) }
    }, []);

    React.useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }
        setLoading(true);
        fetchAllData();

        const requestsRef = ref(db, 'bookRequests');
        const unsubscribe = onValue(requestsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const allRequests: BookRequest[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                setRequests(allRequests);
            } else { setRequests([]); }
             setLoading(false);
        }, (error) => { 
            console.error(error); 
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, fetchAllData]);
    
    const startScanner = React.useCallback(async (type: 'book' | 'user') => {
        if ((type === 'book' && isBookScannerActive) || (type === 'user' && isUserScannerActive) || !isDirectCheckoutOpen) return;
        
        const regionId = type === 'book' ? BOOK_SCANNER_REGION_ID : USER_SCANNER_REGION_ID;
        const setActive = type === 'book' ? setIsBookScannerActive : setIsUserScannerActive;
        const setScanner = type === 'book' ? setBookScanner : setUserScanner;
        
        setActive(true);
        setScannerError(null);

        try {
            await Html5Qrcode.getCameras();
            const qrCodeScanner = new Html5Qrcode(regionId);
            setScanner(qrCodeScanner);
            
            qrCodeScanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText, decodedResult) => {
                    if (type === 'book') {
                        const foundBook = allBooks.find(b => b.barcode === decodedText);
                        if (foundBook) {
                            setSelectedBook(foundBook.id);
                            toast({ title: "Book Found!", description: foundBook.title });
                            stopScanner(type, qrCodeScanner);
                        } else {
                            toast({ variant: 'destructive', title: "Book not found", description: `No book with barcode ${decodedText} was found.` });
                        }
                    } else { // user
                        const foundUser = allUsers.find(u => u.id === decodedText);
                        if(foundUser){
                            setSelectedUser(foundUser.uid);
                            toast({ title: "User Found!", description: foundUser.name });
                            stopScanner(type, qrCodeScanner);
                        } else {
                            toast({ variant: 'destructive', title: "User not found", description: `No user with ID ${decodedText} was found.` });
                        }
                    }
                },
                (errorMessage) => { /* ignore parse errors */ }
            ).catch(err => {
                setScannerError("Could not start scanner. Please ensure you have a camera and have granted permissions.");
            });
        } catch (err) {
            setScannerError("Camera not found or permissions denied.");
            setActive(false);
        }
    }, [isBookScannerActive, isUserScannerActive, isDirectCheckoutOpen, allBooks, allUsers, toast]);

    const stopScanner = React.useCallback(async (type: 'book' | 'user', scannerInstance?: Html5Qrcode | null) => {
        const scannerToStop = scannerInstance || (type === 'book' ? bookScanner : userScanner);
        const isActive = type === 'book' ? isBookScannerActive : isUserScannerActive;
        const setActive = type === 'book' ? setIsBookScannerActive : setIsUserScannerActive;
        const setScanner = type === 'book' ? setBookScanner : setUserScanner;

        if (scannerToStop && isActive) {
            try {
                await scannerToStop.stop();
                setScanner(null);
            } catch (err) {
                console.error("Error stopping scanner:", err);
            } finally {
                 setActive(false);
            }
        }
    }, [bookScanner, userScanner, isBookScannerActive, isUserScannerActive]);

    const handleOpenCheckoutDialog = (requestId: string) => {
        setCheckoutRequestId(requestId);
        setReturnDate(addDays(new Date(), 14));
        setIsCheckoutDialogOpen(true);
    };

    const handleCheckout = async () => {
        if (!checkoutRequestId || !returnDate) return;
        const request = requests.find(r => r.id === checkoutRequestId);
        if (!request) return;

        setActionLoading(request.id);
        const bookRef = ref(db, `libraryBooks/${request.bookId}`);

        try {
            await runTransaction(bookRef, (book) => {
                if (book && book.count > 0) {
                    book.count--;
                    if (book.count === 0) {
                        book.status = 'Checked Out';
                    }
                    return book;
                } else {
                    return; // Abort transaction
                }
            });

            await update(ref(db, `bookRequests/${request.id}`), {
                status: 'Checked Out',
                checkoutDate: new Date().toISOString(),
                dueDate: format(returnDate, 'yyyy-MM-dd')
            });
            await createNotification(
                request.userId,
                `The book "${request.bookTitle}" has been checked out to you. It is due on ${format(returnDate, 'PPP')}.`,
                '/student/library'
            );
            
            toast({ title: "Book Checked Out", description: `${request.bookTitle} has been handed over to ${request.userName}.` });
            setIsCheckoutDialogOpen(false);
            setCheckoutRequestId(null);
            setReturnDate(undefined);
        } catch(e: any) { 
            toast({ variant: 'destructive', title: 'Checkout Failed', description: 'The book may no longer be available.' });
        } 
        finally { setActionLoading(null); }
    };
    
    const handleDecline = async (request: BookRequest) => {
        if (!window.confirm("Are you sure you want to decline this request?")) return;
        setActionLoading(request.id);
        try {
            const updates: Record<string, any> = {};
            updates[`bookRequests/${request.id}/status`] = 'Declined';
            updates[`libraryBooks/${request.bookId}/requesterId`] = null;

            await update(ref(db), updates);

            await createNotification(
                request.userId,
                `Your request for the book "${request.bookTitle}" has been declined.`,
                '/student/library'
            );
            toast({ variant: 'destructive', title: 'Request Declined' });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Decline Failed', description: e.message }); }
        finally { setActionLoading(null); }
    };
    
    const handleDirectCheckout = async () => {
        if (!selectedBook || !selectedUser || !directCheckoutDate) {
            toast({ variant: 'destructive', title: "Missing fields" }); return;
        }
        setActionLoading('direct-checkout');
        const bookRef = ref(db, `libraryBooks/${selectedBook}`);
        const user = allUsers.find(u => u.uid === selectedUser);
        const book = allBooks.find(b => b.id === selectedBook);
        if (!book || !user) return;

        try {
            await runTransaction(bookRef, (currentBook) => {
                if (currentBook && currentBook.count > 0) {
                    currentBook.count--;
                    if(currentBook.count === 0) {
                        currentBook.status = 'Checked Out';
                    }
                    return currentBook;
                }
                return; // Abort
            });

            const newRequestRef = push(ref(db, 'bookRequests'));
            await set(newRequestRef, {
                bookId: book.id,
                bookTitle: book.title,
                userId: user.uid,
                userName: user.name,
                requestDate: new Date().toISOString(),
                status: 'Checked Out',
                checkoutDate: new Date().toISOString(),
                dueDate: format(directCheckoutDate, 'yyyy-MM-dd')
            });
            await createNotification(
                user.uid,
                `A book "${book.title}" has been checked out to you. It is due on ${format(directCheckoutDate, 'PPP')}.`,
                '/student/library'
            );
            toast({ title: "Book Checked Out Directly", description: `${book.title} handed over to ${user.name}.` });
            setIsDirectCheckoutOpen(false);
            setSelectedBook('');
            setSelectedUser('');
            setDirectCheckoutDate(undefined);
        } catch (e: any) { toast({ variant: 'destructive', title: 'Direct Checkout Failed', description: 'Book might be unavailable.' }); }
        finally { setActionLoading(null); }
    }

    const handleReturn = async (request: BookRequest) => {
        setActionLoading(request.id);
        const bookRef = ref(db, `libraryBooks/${request.bookId}`);
        try {
            await runTransaction(bookRef, (book) => {
                if(book){
                    book.count = (book.count || 0) + 1;
                    book.status = 'Available';
                    return book;
                }
                return;
            });
            
            await update(ref(db, `bookRequests/${request.id}`), { status: 'Returned' });
            await createNotification(
                request.userId,
                `The book "${request.bookTitle}" has been successfully returned. Thank you!`,
                '/student/library'
            );
            
            toast({ title: 'Book Returned', description: `${request.bookTitle} has been marked as returned.` });
        } catch(e: any) { toast({ variant: 'destructive', title: 'Return Failed', description: e.message }); } 
        finally { setActionLoading(null); }
    }

    const filteredRequests = React.useMemo(() => {
        const lowerCaseSearch = searchTerm.toLowerCase();
        return requests.filter(req => {
            const tabStatus = activeTab === 'pending' ? 'Pending' : activeTab === 'checked-out' ? 'Checked Out' : 'Returned';
            const statusMatch = req.status === tabStatus;
            const searchMatch = !searchTerm || req.userName.toLowerCase().includes(lowerCaseSearch) || req.bookTitle.toLowerCase().includes(lowerCaseSearch);
            return statusMatch && searchMatch;
        });
    }, [requests, activeTab, searchTerm]);
    
    const canManage = React.useMemo(() => {
        if (!userData) return false;
        return userData.role?.toLowerCase() === 'admin' || userData.subRoles?.includes('Librarian');
    }, [userData]);

    const filteredUsers = React.useMemo(() => {
        if (!userSearch) return allUsers;
        const lowerCaseSearch = userSearch.toLowerCase();
        return allUsers.filter(u => u.name.toLowerCase().includes(lowerCaseSearch) || u.id.toLowerCase().includes(lowerCaseSearch));
    }, [userSearch, allUsers]);

    if (loading) { return <div className="p-6"><Skeleton className="h-96 w-full" /></div>; }
    
    if (!currentUser || !userData) { return <Card><CardContent className="p-6">You must be logged in to view this page.</CardContent></Card>; }

    if (!canManage) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>You do not have permission to view this page. This feature is restricted to Administrators and Librarians.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }
    
    const renderRequestList = (reqs: BookRequest[]) => {
        if (reqs.length === 0) {
            return (
                <div className="py-16 text-center text-muted-foreground">
                    <User className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No requests</h3>
                    <p className="mt-2 text-sm">There are no {activeTab} book requests.</p>
                </div>
            )
        }
        return (
             <div className="grid gap-4 md:grid-cols-2">
                {reqs.map((request) => (
                    <Card key={request.id}>
                        <CardHeader>
                            <CardTitle>{request.bookTitle}</CardTitle>
                            <CardDescription>Requested by: {request.userName}</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                            <p>Request Date: {format(new Date(request.requestDate), 'PPP')}</p>
                            {request.checkoutDate && <p>Checkout Date: {format(new Date(request.checkoutDate), 'PPP')}</p>}
                            {request.dueDate && <p className="font-semibold">Due Date: {format(new Date(request.dueDate), 'PPP')}</p>}
                        </CardContent>
                        <CardFooter className="bg-muted/50 p-3 flex gap-2">
                           {request.status === 'Pending' && (
                                <>
                                <Button variant="destructive" className="flex-1" onClick={() => handleDecline(request)} disabled={!!actionLoading}>
                                   {actionLoading === request.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />} Decline
                                </Button>
                                <Button className="flex-1" onClick={() => handleOpenCheckoutDialog(request.id)} disabled={!!actionLoading}>
                                   {actionLoading === request.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />} Hand Over
                                </Button>
                                </>
                           )}
                           {request.status === 'Checked Out' && (
                               <Button className="w-full" variant="secondary" onClick={() => handleReturn(request)} disabled={!!actionLoading}>
                                   {actionLoading === request.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookCheck className="mr-2 h-4 w-4" />} Mark as Returned
                               </Button>
                           )}
                           {request.status === 'Returned' && (
                               <div className="flex items-center text-green-600 gap-2 text-sm font-medium"><Check/> Returned</div>
                           )}
                        </CardFooter>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="font-headline text-2xl">Manage Book Loans</CardTitle>
                        <CardDescription>Approve pending book requests, check out books directly, and manage returns.</CardDescription>
                    </div>
                     <Dialog open={isDirectCheckoutOpen} onOpenChange={(open) => {
                         setIsDirectCheckoutOpen(open);
                         if (!open) {
                             stopScanner('book');
                             stopScanner('user');
                         }
                     }}>
                        <DialogTrigger asChild>
                             <Button><PlusCircle className="mr-2 h-4 w-4"/> Direct Checkout</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Direct Book Checkout</DialogTitle>
                                <DialogDescription>Check out a book directly to a student or staff member.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label>User</Label>
                                    <div className="flex gap-2">
                                        <Select value={selectedUser} onValueChange={setSelectedUser} disabled={isUserScannerActive}>
                                            <SelectTrigger><SelectValue placeholder="Select user..."/></SelectTrigger>
                                            <SelectContent>
                                                <div className="p-2">
                                                    <Input
                                                        placeholder="Search by name or ID..."
                                                        value={userSearch}
                                                        onChange={(e) => setUserSearch(e.target.value)}
                                                        className="w-full"
                                                    />
                                                </div>
                                                <div className="max-h-[200px] overflow-y-auto">
                                                    {filteredUsers.map(u => <SelectItem key={u.uid} value={u.uid}>{u.name} ({u.id})</SelectItem>)}
                                                </div>
                                            </SelectContent>
                                        </Select>
                                         <Button type="button" variant="outline" size="icon" onClick={isUserScannerActive ? () => stopScanner('user') : () => startScanner('user')}>
                                            {isUserScannerActive ? <X className="h-4 w-4"/> : <User className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                                {isUserScannerActive && <div id={USER_SCANNER_REGION_ID} className="w-full aspect-video border rounded-md"/>}

                                <div className="space-y-2">
                                    <Label>Book</Label>
                                    <div className="flex gap-2">
                                        <Select value={selectedBook} onValueChange={setSelectedBook} disabled={isBookScannerActive}>
                                            <SelectTrigger><SelectValue placeholder="Select book..."/></SelectTrigger>
                                            <SelectContent>{allBooks.filter(b => b.status === 'Available').map(b => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <Button type="button" variant="outline" size="icon" onClick={isBookScannerActive ? () => stopScanner('book') : () => startScanner('book')}>
                                            {isBookScannerActive ? <X className="h-4 w-4"/> : <Barcode className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                                
                                {isBookScannerActive && <div id={BOOK_SCANNER_REGION_ID} className="w-full aspect-video border rounded-md"/>}
                                {scannerError && <Alert variant="destructive"><AlertDescription>{scannerError}</AlertDescription></Alert>}

                                <div className="space-y-2">
                                     <Label>Return Due Date</Label>
                                     <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{directCheckoutDate ? format(directCheckoutDate, 'PPP') : <span>Pick a date</span>}</Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={directCheckoutDate} onSelect={setDirectCheckoutDate} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => { setIsDirectCheckoutOpen(false); stopScanner('book'); stopScanner('user'); }}>Cancel</Button>
                                <Button onClick={handleDirectCheckout} disabled={!!actionLoading || !selectedBook || !selectedUser || !directCheckoutDate}>
                                    {actionLoading === 'direct-checkout' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                                    Confirm Checkout
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                     <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="pending">Pending ({requests.filter(r=>r.status === 'Pending').length})</TabsTrigger>
                            <TabsTrigger value="checked-out">Checked Out ({requests.filter(r=>r.status === 'Checked Out').length})</TabsTrigger>
                            <TabsTrigger value="returned">History ({requests.filter(r=>r.status === 'Returned' || r.status === 'Declined').length})</TabsTrigger>
                        </TabsList>

                        <div className="relative my-4">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search by book or user name..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>

                        <TabsContent value="pending" className="mt-4">{renderRequestList(filteredRequests)}</TabsContent>
                        <TabsContent value="checked-out" className="mt-4">{renderRequestList(filteredRequests)}</TabsContent>
                         <TabsContent value="returned" className="mt-4">{renderRequestList(requests.filter(r => (r.status === 'Returned' || r.status === 'Declined')))}</TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Finalize Checkout</DialogTitle>
                        <DialogDescription>Set a return due date for this book.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                             <Label>Return Due Date</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{returnDate ? format(returnDate, 'PPP') : <span>Pick a date</span>}</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={returnDate} onSelect={setReturnDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleCheckout} disabled={!!actionLoading || !returnDate}>
                            {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                            Confirm Checkout
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
