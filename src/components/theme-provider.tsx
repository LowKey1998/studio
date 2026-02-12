'use client';
import * as React from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';

type NamePart = {
  text: string;
  color: string;
};

type ThemeContextType = {
    institutionName: string;
    institutionLogo: string | null;
    institutionColor: string | null;
    institutionNameParts: NamePart[];
    loadingTheme: boolean;
};

const ThemeContext = React.createContext<ThemeContextType>({
    institutionName: 'Edutrack360',
    institutionLogo: null,
    institutionColor: null,
    institutionNameParts: [],
    loadingTheme: true,
});

// Helper function to convert hex to HSL string components (space-separated)
const hexToHSL = (hex: string) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [institutionName, setInstitutionName] = React.useState('Edutrack360');
    const [institutionLogo, setInstitutionLogo] = React.useState<string | null>(null);
    const [institutionColor, setInstitutionColor] = React.useState<string | null>(null);
    const [institutionNameParts, setInstitutionNameParts] = React.useState<NamePart[]>([]);
    const [loadingTheme, setLoadingTheme] = React.useState(true);

    const applyTheme = React.useCallback((data: any) => {
        const name = data.name || 'Edutrack360';
        setInstitutionName(name);
        setInstitutionLogo(data.logoUrl || null);
        setInstitutionColor(data.color || null);
        setInstitutionNameParts(data.nameParts || []);

        if (typeof window !== 'undefined') {
            document.title = name;
            
            // Primary Brand Color
            if (data.color) {
                const { h, s, l } = hexToHSL(data.color);
                document.documentElement.style.setProperty('--primary', `${h} ${s}% ${l}%`);
                const foreground = l > 50 ? '0 0% 10%' : '0 0% 100%';
                document.documentElement.style.setProperty('--primary-foreground', foreground);
            } else {
                document.documentElement.style.removeProperty('--primary');
                document.documentElement.style.removeProperty('--primary-foreground');
            }

            // Top Bar Background
            if (data.topBarColor) {
                const { h, s, l } = hexToHSL(data.topBarColor);
                document.documentElement.style.setProperty('--header-background', `${h} ${s}% ${l}%`);
            } else {
                document.documentElement.style.removeProperty('--header-background');
            }

            // Sidebar Background
            if (data.sidebarColor) {
                const { h, s, l } = hexToHSL(data.sidebarColor);
                document.documentElement.style.setProperty('--sidebar-background', `${h} ${s}% ${l}%`);
            } else {
                document.documentElement.style.removeProperty('--sidebar-background');
            }

            // Sidebar Text
            if (data.sidebarTextColor) {
                const { h, s, l } = hexToHSL(data.sidebarTextColor);
                document.documentElement.style.setProperty('--sidebar-foreground', `${h} ${s}% ${l}%`);
            } else {
                document.documentElement.style.removeProperty('--sidebar-foreground');
            }
        }
    }, []);

    React.useEffect(() => {
        const settingsRef = ref(db, 'settings/institution');
        const unsubscribe = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                applyTheme(snapshot.val());
            }
            setLoadingTheme(false);
        }, () => {
            setLoadingTheme(false);
        });
        return () => unsubscribe();
    }, [applyTheme]);

    return (
        <ThemeContext.Provider value={{ institutionName, institutionLogo, institutionColor, institutionNameParts, loadingTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => React.useContext(ThemeContext);