-- Migrations for Phase 3: University Spaces (Aethel)

-- 1. Create the spaces table
CREATE TABLE IF NOT EXISTS spaces (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view spaces (for discovery)
CREATE POLICY "Spaces are viewable by everyone." ON spaces
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to create spaces
CREATE POLICY "Users can create spaces." ON spaces
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Allow creators to update their spaces
CREATE POLICY "Creators can update their spaces." ON spaces
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- 2. Create the space_members table
CREATE TABLE IF NOT EXISTS space_members (
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (space_id, user_id)
);

ALTER TABLE space_members ENABLE ROW LEVEL SECURITY;

-- Allow members to see other members of spaces they are in, OR make it public for now
CREATE POLICY "Space members are viewable by everyone." ON space_members
  FOR SELECT TO authenticated USING (true);

-- Allow users to join a space
CREATE POLICY "Users can join spaces." ON space_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow users to leave a space
CREATE POLICY "Users can leave spaces." ON space_members
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- 3. Modify the messages table to support space_id
ALTER TABLE messages ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE CASCADE;

-- Update messages RLS to allow reading if the message belongs to a space the user is a member of
DROP POLICY IF EXISTS "Allow users to read their own messages" ON messages;

CREATE POLICY "Allow users to read their messages and space messages" ON messages
  FOR SELECT TO authenticated
  USING (
    auth.uid() = sender_id 
    OR auth.uid() = receiver_id 
    OR (space_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM space_members WHERE space_members.space_id = messages.space_id AND space_members.user_id = auth.uid()
    ))
  );

-- Allow inserting messages into spaces if the user is a member
DROP POLICY IF EXISTS "Allow users to insert their own messages" ON messages;

CREATE POLICY "Allow users to insert messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    (
      receiver_id IS NOT NULL OR 
      (space_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM space_members WHERE space_members.space_id = messages.space_id AND space_members.user_id = auth.uid()
      ))
    )
  );

-- Update the UPDATE policy to allow space members to react to messages in the space
DROP POLICY IF EXISTS "Allow participants to update messages" ON messages;

CREATE POLICY "Allow participants to update messages" ON messages
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = sender_id 
    OR auth.uid() = receiver_id
    OR (space_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM space_members WHERE space_members.space_id = messages.space_id AND space_members.user_id = auth.uid()
    ))
  );
