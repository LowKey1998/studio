
"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, BookCheck, BookX, PlusCircle, Loader2, Library, BookUp, Upload, Trash2, Pencil, Barcode, X, Camera, Zap, AlertCircle, Check, Copy } from "lucide-react";
import Image from 'next/image';
import { db, storage } from '@/lib/firebase';
import { ref, get, set, push, onValue, serverTimestamp, update, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Html5Qrcode } from 'html5-qrcode';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

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

const statusConfig: { [key in Book['status']]: { variant: 'default' | 'secondary' | 'destructive', icon: React.ReactNode } } = {
  "Available": { variant: 'default', icon: <BookCheck className="mr-1 h-4 w-4" /> },
  "Checked Out": { variant: 'secondary', icon: <BookX className="mr-1 h-4 w-4" /> },
  "Requested": { variant: 'destructive', icon: <BookUp className="mr-1 h-4 w-4" /> },
};

const SCANNER_ID = "isbn-scanner-region";
const BULK_SCANNER_ID = "bulk-isbn-scanner-region";

export default function LibraryPage() {
    const [books, setBooks] = React.useState<Book[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();

    // Add/Edit Book Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingBook, setEditingBook] = React.useState<Book | null>(null);
    const [formLoading, setFormLoading] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [author, setAuthor] = React.useState('');
    const [genre, setGenre] = React.useState('');
    const [barcode, setBarcode] = React.useState('');
    const [year, setYear] = React.useState('');
    const [count, setCount] = React.useState('');
    const [imageUrl, setImageUrl] = React.useState('');
    const [imageFile, setImageFile] = React.useState<File | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Bulk Scan State
    const [isBulkDialogOpen, setIsBulkDialogOpen] = React.useState(false);
    const [bulkScannerActive, setBulkScannerActive] = React.useState(false);
    const [bulkScanner, setBulkScanner] = React.useState<Html5Qrcode | null>(null);
    const [scannedBooks, setScannedBooks] = React.useState<Partial<Book>[]>([]);
    const [processedIsbns, setProcessedIsbns] = React.useState<Set<string>>(new Set());

    // Single Scan State
    const [isScannerActive, setIsScannerActive] = React.useState(false);
    const [scanner, setScanner] = React.useState<Html5Qrcode | null>(null);
    const [lookupIsbn, setLookupIsbn] = React.useState('');
    const [isSearchingIsbn, setIsSearchingIsbn] = React.useState(false);
    const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);

    React.useEffect(() => {
        const booksRef = ref(db, 'libraryBooks');
        const unsubscribe = onValue(booksRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list: Book[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key],
                    hint: "book cover",
                }));
                setBooks(list.reverse());
            } else {
                setBooks([]);
            }
            setLoading(false);
        });

        return () => {
            unsubscribe();
            if (scanner) scanner.stop().catch(() => {});
            if (bulkScanner) bulkScanner.stop().catch(() => {});
        };
    }, [scanner, bulkScanner]);

    const stopScanner = React.useCallback(async () => {
        if (scanner) {
            try {
                await scanner.stop();
                setScanner(null);
            } catch (err) {
                console.error(err);
            } finally {
                 setIsScannerActive(false);
            }
        }
    }, [scanner]);

    const stopBulkScanner = React.useCallback(async () => {
        if (bulkScanner) {
            try {
                await bulkScanner.stop();
                setBulkScanner(null);
            } catch (err) {
                console.error(err);
            } finally {
                 setBulkScannerActive(false);
            }
        }
    }, [bulkScanner]);

    const fetchBookByIsbn = React.useCallback(async (isbn: string, isBulk = false) => {
        const cleanIsbn = isbn.replace(/\D/g, '');
        if (!cleanIsbn) return;

        if (isBulk && processedIsbns.has(cleanIsbn)) return;

        if (!isBulk) setIsSearchingIsbn(true);
        
        try {
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
            const data = await response.json();
            if (data.totalItems > 0) {
                const item = data.items[0].volumeInfo;
                const bookData: Partial<Book> = {
                    title: item.title || '',
                    author: item.authors ? item.authors.join(', ') : 'Unknown',
                    genre: item.categories ? item.categories.join(', ') : 'General',
                    year: item.publishedDate ? parseInt(item.publishedDate.split('-')[0]) : undefined,
                    barcode: cleanIsbn,
                    image: item.imageLinks?.thumbnail?.replace('http://', 'https://') || 'https://placehold.co/300x400.png',
                    count: 1,
                    status: 'Available'
                };

                if (isBulk) {
                    setScannedBooks(prev => [bookData, ...prev]);
                    setProcessedIsbns(prev => new Set(prev).add(cleanIsbn));
                    toast({ title: "Scanned", description: bookData.title });
                } else {
                    setTitle(bookData.title!);
                    setAuthor(bookData.author!);
                    setGenre(bookData.genre!);
                    setYear(String(bookData.year || ''));
                    setBarcode(cleanIsbn);
                    setImageUrl(bookData.image!);
                    toast({ title: "Book Found!", description: bookData.title });
                    if (isScannerActive) stopScanner();
                }
            } else if (!isBulk) {
                toast({ variant: 'destructive', title: "Not Found", description: "No book found for this ISBN." });
            }
        } catch (e) {
            if (!isBulk) toast({ variant: 'destructive', title: "Search Error" });
        } finally {
            if (!isBulk) setIsSearchingIsbn(false);
        }
    }, [isScannerActive, stopScanner, toast, processedIsbns]);

    // Single Scanner Effect
    React.useEffect(() => {
        let qrScanner: Html5Qrcode | null = null;
        if (isScannerActive) {
            const timer = setTimeout(async () => {
                try {
                    qrScanner = new Html5Qrcode(SCANNER_ID);
                    setScanner(qrScanner);
                    await qrScanner.start(
                        { facingMode: "environment" },
                        { fps: 10, qrbox: { width: 250, height: 150 } },
                        (decodedText) => {
                            setLookupIsbn(decodedText);
                            fetchBookByIsbn(decodedText);
                        },
                        () => {}
                    );
                } catch (err) {
                    setIsScannerActive(false);
                }
            }, 300);
            return () => {
                clearTimeout(timer);
                if (qrScanner) qrScanner.stop().catch(() => {});
            };
        }
    }, [isScannerActive, fetchBookByIsbn]);

    // Bulk Scanner Effect
    React.useEffect(() => {
        let qrScanner: Html5Qrcode | null = null;
        if (bulkScannerActive) {
            const timer = setTimeout(async () => {
                try {
                    qrScanner = new Html5Qrcode(BULK_SCANNER_ID);
                    setBulkScanner(qrScanner);
                    await qrScanner.start(
                        { facingMode: "environment" },
                        { fps: 10, qrbox: { width: 250, height: 150 } },
                        (decodedText) => fetchBookByIsbn(decodedText, true),
                        () => {}
                    );
                } catch (err) {
                    setBulkScannerActive(false);
                }
            }, 300);
            return () => {
                clearTimeout(timer);
                if (qrScanner) qrScanner.stop().catch(() => {});
            };
        }
    }, [bulkScannerActive, fetchBookByIsbn]);
    
    const startScanner = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
            setHasCameraPermission(true);
            setIsScannerActive(true);
        } catch (err) {
            setHasCameraPermission(false);
            toast({ variant: 'destructive', title: "Camera Access Denied" });
        }
    };

    const startBulkScanner = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
            setHasCameraPermission(true);
            setBulkScannerActive(true);
        } catch (err) {
            setHasCameraPermission(false);
            toast({ variant: 'destructive', title: "Camera Access Denied" });
        }
    };

    const handleSaveBulk = async () => {
        if (scannedBooks.length === 0) return;
        setFormLoading(true);
        try {
            const updates: Record<string, any> = {};
            scannedBooks.forEach(book => {
                const newRef = push(ref(db, 'libraryBooks'));
                updates[`libraryBooks/${newRef.key}`] = { ...book, createdAt: serverTimestamp() };
            });
            await update(ref(db), updates);
            toast({ title: "Bulk Import Complete", description: `Added ${scannedBooks.length} books.` });
            setScannedBooks([]);
            setProcessedIsbns(new Set());
            setIsBulkDialogOpen(false);
            if (bulkScannerActive) stopBulkScanner();
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Save Failed" });
        } finally {
            setFormLoading(false);
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !author) {
            toast({ variant: 'destructive', title: 'Missing Fields' });
            return;
        }
        setFormLoading(true);
        let finalImageUrl = editingBook?.image || 'https://placehold.co/300x400.png';
        
        try {
            if (imageFile) {
                const imageStorageRef = storageRef(storage, `libraryCovers/${Date.now()}_${imageFile.name}`);
                const snapshot = await uploadBytes(imageStorageRef, imageFile);
                finalImageUrl = await getDownloadURL(snapshot.ref);
            } else if (imageUrl) {
                finalImageUrl = imageUrl;
            }

            const bookData = {
                title, author, genre: genre || '', barcode: barcode || '',
                year: year ? parseInt(year) : null,
                count: count ? parseInt(count) : 1,
                image: finalImageUrl,
                status: editingBook?.status || 'Available'
            };

            if (editingBook) {
                await set(ref(db, `libraryBooks/${editingBook.id}`), bookData);
                toast({ title: 'Book Updated' });
            } else {
                const newBookRef = push(ref(db, 'libraryBooks'));
                await set(newBookRef, { ...bookData, createdAt: serverTimestamp() });
                toast({ title: 'Book Added' });
            }
            
            resetForm();
            setIsDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Operation Failed' });
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteBook = async () => {
        if (!editingBook) return;
        if (!window.confirm("Permanently delete this record?")) return;
        setFormLoading(true);
        try {
            await remove(ref(db, `libraryBooks/${editingBook.id}`));
            toast({ title: 'Book Deleted' });
            setIsDialogOpen(false);
            resetForm();
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Delete Failed' });
        } finally {
            setFormLoading(false);
        }
    };

    const resetForm = () => {
        setEditingBook(null);
        setTitle('');
        setAuthor('');
        setGenre('');
        setBarcode('');
        setYear('');
        setCount('');
        setImageUrl('');
        setImageFile(null);
    };

    const filteredBooks = books.filter(book => 
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.genre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="font-headline text-2xl">Library Catalog Management</CardTitle>
                            <CardDescription>Browse, add, and manage books available in the library.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => { setScannedBooks([]); setProcessedIsbns(new Set()); setIsBulkDialogOpen(true); }}>
                                <Copy className="mr-2 h-4 w-4" /> Bulk ISBN Import
                            </Button>
                            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Book
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full max-w-xl">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search catalog by title, author or genre..." className="pl-8 bg-background" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredBooks.map((book) => (
                        <Card key={book.id} className="flex flex-col overflow-hidden shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group">
                            <CardHeader className="p-0">
                                <div className="relative h-56 w-full">
                                    <Image src={book.image} alt={`Cover of ${book.title}`} layout="fill" objectFit="cover" data-ai-hint={book.hint} />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button variant="secondary" size="sm" onClick={() => {
                                            setEditingBook(book); setTitle(book.title); setAuthor(book.author); setGenre(book.genre);
                                            setBarcode(book.barcode || ''); setYear(String(book.year || '')); setCount(String(book.count || ''));
                                            setImageUrl(book.image); setIsDialogOpen(true);
                                        }} className="font-bold"><Pencil className="mr-2 h-4 w-4"/>Edit Details</Button>
                                    </div>
                                </div>
                                <div className="p-4"><CardTitle className="font-headline text-lg leading-tight line-clamp-1">{book.title}</CardTitle><CardDescription className="line-clamp-1">by {book.author}</CardDescription></div>
                            </CardHeader>
                            <CardContent className="flex flex-grow flex-col gap-2 p-4 pt-0">
                                <div className="flex flex-wrap gap-1.5">
                                    {book.genre && <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter truncate max-w-full">{book.genre.split(',')[0]}</Badge>}
                                    {book.year && <Badge variant="secondary" className="text-[10px] h-5 bg-primary/5 text-primary">Year: {book.year}</Badge>}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 border-t pt-2">
                                    <div className="flex items-center gap-1.5 font-bold"><Library className="h-3 w-3"/> {book.count || 1} Copies</div>
                                    {book.barcode && <div className="flex items-center gap-1.5 font-mono opacity-60"><Barcode className="h-3 w-3"/> {book.barcode}</div>}
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between items-center bg-muted/50 p-4 border-t">
                                <Badge variant={statusConfig[book.status].variant} className="flex items-center h-6 text-[10px] font-black uppercase tracking-widest">{statusConfig[book.status].icon}{book.status}</Badge>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Bulk ISBN Dialog */}
            <Dialog open={isBulkDialogOpen} onOpenChange={(o) => { if(!o) stopBulkScanner(); setIsBulkDialogOpen(o); }}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Bulk ISBN Import</DialogTitle>
                        <DialogDescription>Keep the scanner active to identify multiple books in sequence.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 grid md:grid-cols-2 gap-6 overflow-hidden py-4">
                        <div className="flex flex-col gap-4 border p-4 rounded-xl bg-muted/10">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Active Scanner</Label>
                                <Button variant="outline" size="sm" onClick={bulkScannerActive ? stopBulkScanner : startBulkScanner}>
                                    {bulkScannerActive ? <><X className="mr-2 h-4 w-4"/>Stop</> : <><Camera className="mr-2 h-4 w-4"/>Start Camera</>}
                                </Button>
                            </div>
                            <div id={BULK_SCANNER_ID} className="flex-1 rounded-lg bg-black border-2 border-primary/20 overflow-hidden relative">
                                {!bulkScannerActive && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                                        <Barcode className="h-12 w-12 opacity-20" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Camera Inactive</p>
                                    </div>
                                )}
                            </div>
                            {hasCameraPermission === false && <Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertTitle>Permissions Required</AlertTitle></Alert>}
                        </div>
                        <div className="flex flex-col gap-2 border p-4 rounded-xl overflow-hidden">
                            <Label className="text-[10px] font-black uppercase tracking-widest">Scanned Queue ({scannedBooks.length})</Label>
                            <ScrollArea className="flex-1 bg-muted/5 rounded-lg border p-2">
                                <div className="space-y-2">
                                    {scannedBooks.map((b, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 bg-background border rounded-lg shadow-sm">
                                            {b.image && <img src={b.image} className="w-10 h-14 object-cover rounded" alt="Cover"/>}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-xs truncate">{b.title}</p>
                                                <p className="text-[10px] text-muted-foreground truncate">{b.author}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                                                setScannedBooks(prev => prev.filter((_, idx) => idx !== i));
                                                setProcessedIsbns(prev => { const n = new Set(prev); n.delete(b.barcode!); return n; });
                                            }}><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    ))}
                                    {scannedBooks.length === 0 && <p className="text-center py-20 text-xs text-muted-foreground italic">No books scanned yet.</p>}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                    <DialogFooter className="bg-muted/10 p-6 border-t rounded-b-lg">
                        <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>Close</Button>
                        <Button onClick={handleSaveBulk} disabled={formLoading || scannedBooks.length === 0} className="px-8 font-bold shadow-lg">
                            {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                            Import {scannedBooks.length} Books
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(o) => { if (!o) resetForm(); setIsDialogOpen(o); }}>
                <DialogContent className="sm:max-w-xl">
                    <form onSubmit={handleFormSubmit}>
                        <DialogHeader>
                            <DialogTitle className="font-headline">{editingBook ? 'Edit' : 'Add New'} Book</DialogTitle>
                            <DialogDescription>Provide details or use ISBN lookup to auto-fill.</DialogDescription>
                        </DialogHeader>
                        <div className="grid max-h-[70vh] gap-6 overflow-y-auto py-4 pr-4">
                            <div className="space-y-2 p-4 rounded-xl border bg-muted/20">
                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Barcode className="h-3 w-3" /> ISBN Lookup</Label>
                                <div className="flex gap-2">
                                    <Input placeholder="Enter ISBN..." value={lookupIsbn} onChange={e => setLookupIsbn(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), fetchBookByIsbn(lookupIsbn))} className="bg-background font-mono h-10"/>
                                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={isScannerActive ? stopScanner : startScanner}>{isScannerActive ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}</Button>
                                    <Button type="button" size="sm" className="h-10 px-4" onClick={() => fetchBookByIsbn(lookupIsbn)} disabled={isSearchingIsbn || !lookupIsbn}>{isSearchingIsbn ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Zap className="mr-2 h-4 w-4 mr-1.5"/>}Lookup</Button>
                                </div>
                                {isScannerActive && <div id={SCANNER_ID} className="w-full aspect-[4/3] mt-2 rounded-lg border overflow-hidden bg-black shadow-inner" />}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1"><Label htmlFor="title">Title *</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={formLoading} required /></div>
                                <div className="space-y-1"><Label htmlFor="author">Author *</Label><Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} disabled={formLoading} required /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><Label htmlFor="genre">Genre</Label><Input id="genre" value={genre} onChange={(e) => setGenre(e.target.value)} disabled={formLoading} /></div>
                                <div className="space-y-1"><Label htmlFor="count">Copies</Label><Input id="count" type="number" value={count} onChange={(e) => setCount(e.target.value)} disabled={formLoading} /></div>
                            </div>
                            <div className="space-y-1"><Label>Image URL</Label><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} disabled={formLoading} /></div>
                        </div>
                        <DialogFooter className="flex justify-between w-full border-t pt-4">
                            {editingBook && <Button type="button" variant="ghost" className="text-destructive font-bold" onClick={handleDeleteBook} disabled={formLoading}>Delete</Button>}
                            <div className="flex gap-2">
                                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={formLoading} className="font-bold">{formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingBook ? 'Save' : 'Add'}</Button>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
