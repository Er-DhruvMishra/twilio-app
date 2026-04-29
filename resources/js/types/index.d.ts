export interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at?: string;
    presence?: 'available' | 'busy' | 'away' | 'offline';
    roles?: string[];
    permissions?: string[];
}

export interface Badges {
    missedCalls: number;
    unreadMessages: number;
    unreadVoicemails: number;
    unreadFaxes?: number;
    unreadMail?: number;
    unreadChat?: number;
    unreadRcs?: number;
    unreadWhatsapp?: number;
    unreadFacebook?: number;
    lowBalance?: boolean;
}

export interface TwilioStatus {
    configured: boolean;
    phoneNumber: string | null;
    numberProvisioned?: boolean;
    twimlAppReady?: boolean;
    webhookBaseUrl?: string;
    webhookPublic?: boolean;
}

export interface ReverbConfig {
    key: string;
    host: string;
    port: number;
    scheme: 'http' | 'https';
}

export interface VapidConfig {
    publicKey: string | null;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User | null;
    };
    badges?: Badges | null;
    twilio?: TwilioStatus;
    reverb?: ReverbConfig;
    vapid?: VapidConfig;
    flash?: {
        success?: string;
        error?: string;
    };
};
