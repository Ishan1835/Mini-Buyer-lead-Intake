-- Create enum for lead status
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'not_qualified', 'closed');

-- Create enum for lead source
CREATE TYPE public.lead_source AS ENUM ('website', 'referral', 'social_media', 'cold_call', 'email_campaign', 'other');

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'agent', 'viewer');

-- Create profiles table for user management
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    role app_role DEFAULT 'agent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create buyer_leads table
CREATE TABLE public.buyer_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Lead Information
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    
    -- Property Preferences
    budget_min DECIMAL(12,2),
    budget_max DECIMAL(12,2),
    preferred_areas TEXT[],
    property_type TEXT,
    bedrooms INTEGER,
    bathrooms DECIMAL(3,1),
    
    -- Lead Details
    status lead_status DEFAULT 'new',
    source lead_source DEFAULT 'website',
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
    notes TEXT,
    
    -- Contact Information
    last_contacted TIMESTAMP WITH TIME ZONE,
    next_follow_up TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create lead_activities table for history tracking
CREATE TABLE public.lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.buyer_leads(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- Create function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE user_id = $1;
$$;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_buyer_leads_updated_at
    BEFORE UPDATE ON public.buyer_leads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'User'),
        'agent'
    );
    RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" 
    ON public.profiles FOR SELECT 
    USING (true);

CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = user_id);

-- RLS Policies for buyer_leads
CREATE POLICY "Admins can do everything with leads" 
    ON public.buyer_leads FOR ALL 
    USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Agents can view all leads" 
    ON public.buyer_leads FOR SELECT 
    USING (public.get_user_role(auth.uid()) IN ('admin', 'agent', 'viewer'));

CREATE POLICY "Agents can create leads" 
    ON public.buyer_leads FOR INSERT 
    WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'agent'));

CREATE POLICY "Agents can update leads they created or are assigned to" 
    ON public.buyer_leads FOR UPDATE 
    USING (
        public.get_user_role(auth.uid()) = 'admin' OR
        created_by = auth.uid() OR 
        assigned_to = auth.uid()
    );

CREATE POLICY "Only admins can delete leads" 
    ON public.buyer_leads FOR DELETE 
    USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for lead_activities
CREATE POLICY "Users can view activities for leads they have access to" 
    ON public.lead_activities FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.buyer_leads bl 
            WHERE bl.id = lead_activities.lead_id 
            AND (
                public.get_user_role(auth.uid()) = 'admin' OR
                bl.created_by = auth.uid() OR 
                bl.assigned_to = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create activities for accessible leads" 
    ON public.lead_activities FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.buyer_leads bl 
            WHERE bl.id = lead_activities.lead_id 
            AND (
                public.get_user_role(auth.uid()) = 'admin' OR
                bl.created_by = auth.uid() OR 
                bl.assigned_to = auth.uid()
            )
        )
    );

-- Create indexes for performance
CREATE INDEX idx_buyer_leads_created_by ON public.buyer_leads(created_by);
CREATE INDEX idx_buyer_leads_assigned_to ON public.buyer_leads(assigned_to);
CREATE INDEX idx_buyer_leads_status ON public.buyer_leads(status);
CREATE INDEX idx_buyer_leads_source ON public.buyer_leads(source);
CREATE INDEX idx_buyer_leads_created_at ON public.buyer_leads(created_at DESC);
CREATE INDEX idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX idx_lead_activities_created_at ON public.lead_activities(created_at DESC);