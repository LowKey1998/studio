
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Book, Search, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';

interface Book {
  id: string;
  title: string;
  author: string;
  imageUrl: string;
  copiesAvailable: number;
  dataAiHint?: string;
}

const BookCardSkeleton = () => (
    <Card className="overflow-hidden flex flex-col">
        <Skeleton className="w-full h-48" />
        <CardHeader className="flex-grow">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-2" />
        </CardHeader>
        <CardContent className="mt-auto">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full mt-4" />
        </CardContent>
    </Card>
);


export default function LibraryPage() {
    const [books, setBooks] = useState<Book[]>([]);
    const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const booksRef = ref(db, 'library/books');

        const listener = onValue(booksRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const bookList = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setBooks(bookList);
                setFilteredBooks(bookList);
            } else {
                setBooks([]);
                setFilteredBooks([]);
            }
            setLoading(false);
        }, (error) => {
            console.error(error);
            setLoading(false);
        });

        // Cleanup listener on component unmount
        return () => {
            off(booksRef, 'value', listener);
        };
    }, []);

    useEffect(() => {
        const results = books.filter(book =>
            book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            book.author.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredBooks(results);
    }, [searchTerm, books]);


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Library Catalog</CardTitle>
          <CardDescription>Browse and borrow books from our collection.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search by title, author, or keyword..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
             {loading ? (
                Array.from({ length: 6 }).map((_, i) => <BookCardSkeleton key={i} />)
            ) : filteredBooks.length > 0 ? (
                filteredBooks.map((book) => (
                <Card key={book.id} className="overflow-hidden flex flex-col">
                    <div className="relative w-full h-48 bg-secondary">
                    <Image
                        src={book.imageUrl}
                        alt={book.title}
                        layout="fill"
                        objectFit="cover"
                        data-ai-hint={book.dataAiHint || 'book cover'}
                        />
                    </div>
                    <CardHeader className="flex-grow">
                    <CardTitle className="text-base">{book.title}</CardTitle>
                    <CardDescription>{book.author}</CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto">
                    <p className={`text-sm ${book.copiesAvailable > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {book.copiesAvailable > 0 ? `${book.copiesAvailable} copies available` : 'Out of stock'}
                    </p>
                    <Button className="w-full mt-4" disabled={book.copiesAvailable === 0}>
                        <Book className="mr-2 h-4 w-4" />
                        Borrow
                    </Button>
                    </CardContent>
                </Card>
                ))
            ) : (
                <div className="col-span-full text-center py-10">
                    <p className="text-muted-foreground">No books found. The library catalog is currently empty.</p>
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
