'use client';

import { useState, useRef, useEffect } from 'react';
import {
  HelpCircle, X, BookOpen, Package, ShoppingCart,
  Wallet, CreditCard, User, Lightbulb, AlertTriangle,
  ChevronRight, ClipboardList, Users, Search,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <p className="text-sm text-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-primary/8 border border-primary/20 p-4 text-sm flex gap-3">
      <Lightbulb size={16} className="text-primary shrink-0 mt-0.5" />
      <p className="text-foreground/80 leading-relaxed">{children}</p>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 text-sm flex gap-3">
      <AlertTriangle size={16} className="text-yellow-600 shrink-0 mt-0.5" />
      <p className="text-yellow-800 leading-relaxed">{children}</p>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, color = 'text-primary' }: { icon: React.ElementType; title: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon size={20} className={color} />
      </div>
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
    </div>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground mt-6 mb-3 uppercase tracking-wide">{children}</h3>;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>
  );
}

// ─── Section Content ─────────────────────────────────────────────────────────

function GettingStarted() {
  return (
    <div className="space-y-5">
      <SectionHeading icon={BookOpen} title="Getting Started" />

      <p className="text-sm text-muted-foreground leading-relaxed">
        Welcome to <strong className="text-foreground">Enechambs</strong> — your all-in-one business management platform. Whether you're recording a sale, tracking inventory, or managing customer credit, everything you need lives right here. Let's get you up to speed! 🎉
      </p>

      <Tip>You only need your email and password to get in. If you haven't set a password yet, check your email for a setup link from your admin.</Tip>

      <H3>Logging In</H3>
      <div className="space-y-3">
        <Step n={1} text="Go to the Enechambs login page." />
        <Step n={2} text="Enter your work email address and your password." />
        <Step n={3} text="Hit Sign In — you'll land on your home page automatically." />
      </div>

      <Warn>Never share your password with anyone, including your admin. If you think someone else knows it, contact your admin to reset it immediately.</Warn>

      <H3>What Staff Can Do</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        As a staff member you have access to the core day-to-day features:
      </p>
      <ul className="space-y-2 text-sm text-foreground pl-2">
        {[
          'View and manage inventory items',
          'Record new sales',
          'Manage collections',
          'Handle customer credits',
          'Log incoming orders (customer inquiries)',
        ].map((item) => (
          <li key={item} className="flex items-center gap-2">
            <ChevronRight size={13} className="text-primary shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      <H3>What Only Admins Can Do</H3>
      <ul className="space-y-2 text-sm text-muted-foreground pl-2">
        {[
          'View the full Dashboard with business statistics',
          'Register new staff members',
          'View all users and their activity',
          'Access profit reports and revenue charts',
          'View all staff sales (not just their own)',
        ].map((item) => (
          <li key={item} className="flex items-center gap-2">
            <ChevronRight size={13} className="text-muted-foreground shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      <H3>Navigating the App</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        The <strong className="text-foreground">sidebar on the left</strong> is your main navigation. Each icon takes you to a different section. Your name and role are shown at the very bottom of the sidebar, and the <strong className="text-foreground">Logout</strong> button lives there too.
      </p>

      <H3>Global Search</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        The <strong className="text-foreground">search bar at the top</strong> of every page lets you search across the entire platform — inventory items, sales, credits, customers, and incoming orders — all at once.
      </p>
      <div className="space-y-3">
        <Step n={1} text="Click the search bar in the top header, or press ⌘K (Mac) / Ctrl+K (Windows) to open it from anywhere." />
        <Step n={2} text="Start typing at least 2 characters — results appear instantly grouped by type." />
        <Step n={3} text="Click any result to navigate directly to that section." />
      </div>
      <Tip>Use global search to quickly find a customer by name, look up a sale by product, or check on an inventory item — no need to navigate to each page manually.</Tip>

      <Tip>Click the Activity button in the top-right corner of any page to see a live feed of recent actions across the platform.</Tip>
    </div>
  );
}

function InventoryGuide() {
  return (
    <div className="space-y-5">
      <SectionHeading icon={Package} title="Inventory" />

      <p className="text-sm text-muted-foreground leading-relaxed">
        The Inventory page is where all your products live. Every item you sell, give on credit, or collect passes through here first. Think of it as your digital stock room.
      </p>

      <H3>Reading the Inventory Table</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Each row is one physical item. Here's what the key columns mean:
      </p>
      <div className="space-y-2">
        {[
          { label: 'Available', color: 'bg-green-500/10 text-green-700', desc: 'In stock and ready to sell.' },
          { label: 'Sold', color: 'bg-blue-500/10 text-blue-700', desc: 'Already sold to a customer.' },
          { label: 'In Collection', color: 'bg-yellow-500/10 text-yellow-700', desc: 'Given out as a collection — not yet paid or returned.' },
        ].map(({ label, color, desc }) => (
          <div key={label} className="flex items-center gap-3 text-sm">
            <Badge label={label} color={color} />
            <span className="text-muted-foreground">{desc}</span>
          </div>
        ))}
      </div>

      <H3>Adding a New Product</H3>
      <div className="space-y-3">
        <Step n={1} text='Click the "+ Add Item" button in the top-right corner.' />
        <Step n={2} text="Fill in the product name, company/brand, color, and storage size (use N/A if not applicable)." />
        <Step n={3} text="Enter the IMEI or serial number. For non-gadgets like accessories, N/A is fine." />
        <Step n={4} text="Set the Cost Price (what you paid), the Selling Price (what you charge), and the Threshold Price (your floor/minimum)." />
        <Step n={5} text='Click "Save" and the item appears in the list immediately.' />
      </div>

      <Tip>The threshold price is your safety net — when recording a sale or credit, the system will warn you if you're going below this amount so you never accidentally undersell.</Tip>

      <H3>Editing a Product</H3>
      <div className="space-y-3">
        <Step n={1} text="Find the item in the table. Use the search bar to narrow it down quickly." />
        <Step n={2} text="Click the pencil (edit) icon on the right side of the row." />
        <Step n={3} text="Update any fields you need and save." />
      </div>

      <H3>What is an IMEI?</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        An <strong className="text-foreground">IMEI</strong> (International Mobile Equipment Identity) is a unique 15-digit number that identifies a phone or tablet. It's like a fingerprint for the device. Recording it accurately lets you track exactly which physical unit was sold or is on credit — critical for disputes or warranty claims.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        For non-phone accessories (cables, pouches, etc.), just enter <strong className="text-foreground">N/A</strong>.
      </p>

      <Warn>Always double-check the IMEI before saving. A wrong IMEI makes it impossible to trace the device later.</Warn>
    </div>
  );
}

function SalesGuide() {
  return (
    <div className="space-y-5">
      <SectionHeading icon={ShoppingCart} title="Sales" />

      <p className="text-sm text-muted-foreground leading-relaxed">
        Every time a customer walks out with a product and pays for it, that's a sale. Recording it here keeps your inventory accurate and generates a receipt automatically.
      </p>

      <H3>Recording a New Sale</H3>
      <div className="space-y-3">
        <Step n={1} text='Click "+ Record Sale" in the top-right corner.' />
        <Step n={2} text="Search for and select the inventory item from the dropdown. The price will auto-fill — you can change it if needed." />
        <Step n={3} text="Set the sale date (defaults to today)." />
        <Step n={4} text='Choose the condition: "New" for brand-new items, "Used" for pre-owned.' />
        <Step n={5} text="Start typing the customer's name — a dropdown will suggest returning customers. Select one to auto-fill their phone and email." />
        <Step n={6} text="If it's a new customer, finish typing their name, then enter their 11-digit phone number and optionally their email." />
        <Step n={7} text='"Account Paid To" — enter the bank account or payment method the customer paid into (e.g. Enechambs company, personal account name, POS).' />
        <Step n={8} text='If this sale is to a wholesale vendor, tick "Mark as Vendor sale" at the bottom of the form.' />
        <Step n={9} text='"Record Sale" — the item status switches to Sold and a receipt is generated.' />
      </div>

      <Tip>If the amount you enter is below the item's threshold price, you'll see a warning in orange. You can still proceed, but it's worth double-checking with your manager first.</Tip>

      <H3>Returning Customer Auto-fill</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        When you type a customer's name in the Customer Name field, Enechambs searches existing customers and shows suggestions after 2 characters. Selecting a suggestion fills in their phone number, email, and vendor status automatically — saving you time and reducing typos.
      </p>
      <Tip>Customer names auto-capitalise as you type — no need to worry about case.</Tip>

      <H3>Vendor Sales</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        If a buyer is a <strong className="text-foreground">wholesale vendor</strong> (not a regular retail customer), tick the <strong className="text-foreground">"Mark as Vendor sale"</strong> checkbox at the bottom of the form. This records them separately in the Vendors tab on the Customers page, keeping your retail customer list clean.
      </p>

      <H3>My Sales Tab</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Switch to the <strong className="text-foreground">My Sales</strong> tab to see only the sales you personally recorded. Great for tracking your own performance without the noise of everyone else's transactions.
      </p>

      <H3>Viewing a Receipt</H3>
      <div className="space-y-3">
        <Step n={1} text="Find the sale in the table." />
        <Step n={2} text='Click the "View" button in the Receipt column.' />
        <Step n={3} text="A formatted receipt opens in a new tab — you can print it or share it with the customer." />
      </div>

      <Warn>Once a sale is recorded it cannot be edited. Make sure all details are correct before hitting Record Sale.</Warn>
    </div>
  );
}

function CollectionsGuide() {
  return (
    <div className="space-y-5">
      <SectionHeading icon={Wallet} title="Collections" />

      <p className="text-sm text-muted-foreground leading-relaxed">
        A <strong className="text-foreground">collection</strong> is when an item is given to a customer to take away — but it hasn't been fully paid for yet and may need to be returned. It's a common arrangement for trusted customers or corporate clients.
      </p>

      <Tip>Think of a collection as "I'll take it now and sort the payment later." It's different from a credit — a credit tracks money owed, while a collection tracks the physical item.</Tip>

      <H3>Recording a Collection</H3>
      <div className="space-y-3">
        <Step n={1} text='Click "+ New Collection" in the top-right corner.' />
        <Step n={2} text="Select the inventory item being given out." />
        <Step n={3} text="Enter the collection date, amount, and the customer's details." />
        <Step n={4} text='Set the due date — when you expect payment or the item back.' />
        <Step n={5} text='"Record Collection" — the item status changes to In Collection.' />
      </div>

      <H3>Collection Statuses</H3>
      <div className="space-y-2">
        {[
          { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-700', desc: 'Awaiting payment or return.' },
          { label: 'Paid', color: 'bg-green-500/10 text-green-700', desc: 'Customer has fully settled the amount.' },
          { label: 'Returned', color: 'bg-blue-500/10 text-blue-700', desc: 'Item has been physically returned.' },
        ].map(({ label, color, desc }) => (
          <div key={label} className="flex items-center gap-3 text-sm">
            <Badge label={label} color={color} />
            <span className="text-muted-foreground">{desc}</span>
          </div>
        ))}
      </div>

      <H3>Updating a Collection Status</H3>
      <div className="space-y-3">
        <Step n={1} text="Find the collection in the table." />
        <Step n={2} text='Click the "Update Status" dropdown or button on that row.' />
        <Step n={3} text='Choose "Paid" if the customer has settled, or "Returned" if the item came back.' />
      </div>

      <Warn>Only change a collection to Paid when you have actually received the full payment. Marking it early causes inventory and financial discrepancies.</Warn>
    </div>
  );
}

function CreditsGuide() {
  return (
    <div className="space-y-5">
      <SectionHeading icon={CreditCard} title="Credits" />

      <p className="text-sm text-muted-foreground leading-relaxed">
        A <strong className="text-foreground">credit</strong> in Enechambs means a customer has taken a product and is paying for it over time — in instalments or after a delay. The Credits page helps you track exactly how much each customer owes and how much they've paid.
      </p>

      <Tip>Credits are different from collections. A credit always involves partial or deferred payment tracking. Collections focus on whether the item is returned.</Tip>

      <H3>Creating a New Credit</H3>
      <div className="space-y-3">
        <Step n={1} text='Click "+ New Credit" in the top-right corner.' />
        <Step n={2} text="Select the inventory item. The total amount will auto-fill from the selling price." />
        <Step n={3} text="Set the credit date and the due date — when full payment is expected." />
        <Step n={4} text="Enter an initial deposit (if the customer paid something upfront). This is optional — leave blank or set to 0 if nothing was paid." />
        <Step n={5} text="Fill in the customer's name, phone, and optionally email." />
        <Step n={6} text='"Record Credit" — the credit appears in the list with a Pending status.' />
      </div>

      <H3>Credit Statuses Explained</H3>
      <div className="space-y-2">
        {[
          { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-700', desc: 'No payment received yet.' },
          { label: 'Partial', color: 'bg-blue-500/10 text-blue-700', desc: 'Some payment received but balance remains.' },
          { label: 'Paid', color: 'bg-green-500/10 text-green-700', desc: 'Fully settled — nothing more owed.' },
          { label: 'Overdue', color: 'bg-orange-500/10 text-orange-700', desc: 'Past the due date and still unpaid.' },
          { label: 'Defaulted', color: 'bg-red-500/10 text-red-600', desc: 'Customer has not paid and is unlikely to — flagged for action.' },
        ].map(({ label, color, desc }) => (
          <div key={label} className="flex items-start gap-3 text-sm">
            <Badge label={label} color={color} />
            <span className="text-muted-foreground leading-relaxed">{desc}</span>
          </div>
        ))}
      </div>

      <H3>Recording a Payment</H3>
      <div className="space-y-3">
        <Step n={1} text="Find the credit in the table and click the payment button (or expand the row)." />
        <Step n={2} text="Enter the amount the customer is paying now." />
        <Step n={3} text="Add an optional note (e.g. 'Bank transfer 20 April')." />
        <Step n={4} text="Save — the outstanding balance updates automatically and the status changes to Partial or Paid." />
      </div>

      <H3>What to Do About Overdue Credits</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        The system automatically marks credits as <strong className="text-foreground">Overdue</strong> when the due date passes without full payment. You'll see a badge on the Credits link in the sidebar telling you how many are overdue.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        When you see an overdue credit, reach out to the customer and record any payment they make. If it becomes clear they won't pay, you can escalate to your admin to mark it as <strong className="text-foreground">Defaulted</strong>.
      </p>

      <Warn>You cannot manually set a credit to Overdue before its due date — the system enforces this to prevent mistakes.</Warn>
    </div>
  );
}

function MyAccountGuide() {
  return (
    <div className="space-y-5">
      <SectionHeading icon={User} title="My Account" />

      <p className="text-sm text-muted-foreground leading-relaxed">
        Your account is how Enechambs knows who's doing what. Every sale, credit, and collection you record is linked to your name — so keeping your account secure matters.
      </p>

      <H3>Logging Out</H3>
      <div className="space-y-3">
        <Step n={1} text="Scroll to the bottom of the left sidebar." />
        <Step n={2} text='Click the "Logout" button next to your name.' />
        <Step n={3} text="You'll be taken back to the login screen. Simple!" />
      </div>

      <Tip>Always log out when you're done — especially on shared devices. This protects your account and keeps records accurate.</Tip>

      <H3>Forgot Your Password?</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Enechambs doesn't have a self-serve password reset — your admin handles this for security reasons. Here's what to do:
      </p>
      <div className="space-y-3">
        <Step n={1} text="Contact your admin and let them know you need a password reset." />
        <Step n={2} text="They'll send a setup link to your registered email address." />
        <Step n={3} text="Click the link in the email, set your new password, and you're back in." />
      </div>

      <Warn>Password reset links expire after a short time. Use the link as soon as you receive it. If it expires, just ask your admin to send another one.</Warn>

      <H3>Something Not Working?</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        If you run into an error or something looks wrong:
      </p>
      <ul className="space-y-2 text-sm text-muted-foreground pl-2">
        {[
          'Try refreshing the page first — most glitches go away.',
          'If an action fails with an error message, note what the message says.',
          'Contact your admin with the details of what you were doing and what the error said.',
          'Never try to work around a system error by entering fake data.',
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <ChevronRight size={13} className="text-muted-foreground shrink-0 mt-1" />
            {item}
          </li>
        ))}
      </ul>

      <Tip>Your admin can see all activity logs — so if something goes wrong, they can help trace exactly what happened and fix it quickly.</Tip>
    </div>
  );
}

function IncomingOrdersGuide() {
  return (
    <div className="space-y-5">
      <SectionHeading icon={ClipboardList} title="Incoming Orders" />

      <p className="text-sm text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Incoming Orders</strong> (also called inquiries) are customer requests or reservations for items that haven't been sold yet. Use this section to log when a customer expresses interest in a product so nothing falls through the cracks.
      </p>

      <Tip>Think of an incoming order as a "hold" or "pre-order." The item hasn't changed hands yet — you're just recording that a customer wants it.</Tip>

      <H3>Recording a New Inquiry</H3>
      <div className="space-y-3">
        <Step n={1} text='Click "+ New Inquiry" in the top-right corner.' />
        <Step n={2} text="Optionally select an inventory item if the customer wants a specific product already in stock." />
        <Step n={3} text="Set the inquiry date and the expiry date — when the reservation lapses if the customer doesn't follow through." />
        <Step n={4} text="Enter the expected amount the customer is willing to pay." />
        <Step n={5} text="Fill in the customer's name, phone number, and optionally email." />
        <Step n={6} text="Add any notes about the inquiry (e.g. 'wants black colour only', 'will call back Thursday')." />
        <Step n={7} text='"Record Inquiry" — it appears in the list with a Pending status.' />
      </div>

      <H3>Inquiry Statuses</H3>
      <div className="space-y-2">
        {[
          { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-700', desc: 'Customer has expressed interest — no sale made yet.' },
          { label: 'Converted', color: 'bg-green-500/10 text-green-700', desc: 'The inquiry led to an actual sale or credit.' },
          { label: 'Cancelled', color: 'bg-red-500/10 text-red-700', desc: 'Customer no longer interested or did not follow through.' },
        ].map(({ label, color, desc }) => (
          <div key={label} className="flex items-start gap-3 text-sm">
            <Badge label={label} color={color} />
            <span className="text-muted-foreground leading-relaxed">{desc}</span>
          </div>
        ))}
      </div>

      <H3>Updating an Inquiry Status</H3>
      <div className="space-y-3">
        <Step n={1} text='Find the inquiry in the table and use the "Update Status" dropdown on that row.' />
        <Step n={2} text='If the customer followed through and bought the item, set it to "Converted".' />
        <Step n={3} text='If they changed their mind or stopped responding, set it to "Cancelled".' />
      </div>

      <H3>Finding Similar Items</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        If the specific item a customer wants isn't in stock, click the <strong className="text-foreground">Similar</strong> button on an inquiry row to see other available items that might match what they're looking for.
      </p>

      <Warn>Don't leave inquiries as Pending indefinitely. Check them regularly and update their status — expired inquiries should be Cancelled to keep your list accurate.</Warn>
    </div>
  );
}

function CustomersVendorsGuide() {
  return (
    <div className="space-y-5">
      <SectionHeading icon={Users} title="Customers & Vendors" />

      <p className="text-sm text-muted-foreground leading-relaxed">
        The <strong className="text-foreground">Customers page</strong> (admin only) gives you a full picture of everyone who has bought from Enechambs. It's split into three tabs to keep retail customers and wholesale vendors clearly separated.
      </p>

      <H3>The Three Tabs</H3>
      <div className="space-y-3">
        {[
          { label: 'All Contacts', desc: 'Everyone — both regular customers and vendors — in one view.' },
          { label: 'Regular Customers', desc: 'Only retail customers (sales recorded without the vendor checkbox).' },
          { label: 'Vendors', desc: 'Only wholesale buyers (sales recorded with "Mark as Vendor sale" ticked).' },
        ].map(({ label, desc }) => (
          <div key={label} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{label}</span>
            <span className="text-muted-foreground leading-relaxed">{desc}</span>
          </div>
        ))}
      </div>

      <H3>What Each Row Shows</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        For <strong className="text-foreground">Regular Customers</strong>, you can see their total purchases, total amount spent, credit history, and when they last bought from Enechambs.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        For <strong className="text-foreground">Vendors</strong>, you see their order count, total purchase value, and when they were first added.
      </p>

      <H3>Broadcast Email</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        The <strong className="text-foreground">Broadcast Email</strong> button lets admins send a message to all customers and staff who have an email address on record. Use this for promotions, announcements, or important notices.
      </p>
      <div className="space-y-3">
        <Step n={1} text='Click "Broadcast Email" in the top-right corner.' />
        <Step n={2} text="Optionally enter a sender name (e.g. Enechambs Team)." />
        <Step n={3} text="Write a subject line and your message." />
        <Step n={4} text='"Send Broadcast" — a summary shows how many emails were delivered successfully.' />
      </div>

      <Tip>Search within any tab by name, email, or phone number to quickly find a specific customer or vendor.</Tip>

      <Warn>Broadcast emails go to everyone with an email on record. Double-check your message before sending — it cannot be recalled.</Warn>

      <H3>How Customers Are Created</H3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Customers are automatically added when a sale is recorded. There's no separate "add customer" flow — just record the sale and the customer appears in the right tab based on whether the vendor checkbox was ticked.
      </p>

      <div className="rounded-xl bg-primary/8 border border-primary/20 p-4 text-sm flex gap-3">
        <Search size={16} className="text-primary shrink-0 mt-0.5" />
        <p className="text-foreground/80 leading-relaxed">
          <strong>Pro tip:</strong> Use the global search bar at the top to find a customer instantly without navigating to this page first.
        </p>
      </div>
    </div>
  );
}

// ─── Tab Config ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'start',       label: 'Getting Started',   icon: BookOpen,       content: GettingStarted },
  { id: 'inventory',   label: 'Inventory',          icon: Package,        content: InventoryGuide },
  { id: 'sales',       label: 'Sales',              icon: ShoppingCart,   content: SalesGuide },
  { id: 'collections', label: 'Collections',        icon: Wallet,         content: CollectionsGuide },
  { id: 'credits',     label: 'Credits',            icon: CreditCard,     content: CreditsGuide },
  { id: 'orders',      label: 'Incoming Orders',    icon: ClipboardList,  content: IncomingOrdersGuide },
  { id: 'customers',   label: 'Customers & Vendors',icon: Users,          content: CustomersVendorsGuide },
  { id: 'account',     label: 'My Account',         icon: User,           content: MyAccountGuide },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Main Component ───────────────────────────────────────────────────────────

const EXPIRY = new Date('2026-05-12T00:00:00Z');

export default function StaffGuide() {
  if (new Date() >= EXPIRY) return null;

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('start');
  const [visible, setVisible] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Fade in/out on tab change
  const [contentVisible, setContentVisible] = useState(true);

  const handleTabChange = (id: TabId) => {
    setContentVisible(false);
    setTimeout(() => {
      setActiveTab(id);
      setContentVisible(true);
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 150);
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => setVisible(true), 10);
    } else {
      setVisible(false);
    }
  }, [open]);

  const currentIndex = TABS.findIndex((t) => t.id === activeTab);
  const ActiveContent = TABS[currentIndex].content;

  return (
    <>
      {/* Floating help button */}
      <button
        onClick={() => setOpen(true)}
        title="Staff Guide"
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
      >
        <HelpCircle size={22} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className={`fixed inset-0 bg-black/40 z-50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      {open && (
        <div
          className={`fixed inset-y-0 right-0 w-full max-w-2xl bg-card shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
            visible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b flex items-center justify-between shrink-0">
            <div>
              <h1 className="text-base font-bold text-foreground">Staff Guide</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Everything you need to know about Enechambs</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="px-6 pt-3 pb-1 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Section {currentIndex + 1} of {TABS.length}</span>
              <span className="text-xs text-primary font-medium">{TABS[currentIndex].label}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / TABS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Tab sidebar */}
            <nav className="w-44 shrink-0 border-r py-4 flex flex-col gap-1 px-2">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleTabChange(id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left w-full ${
                    activeTab === id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  {label}
                </button>
              ))}
            </nav>

            {/* Content */}
            <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-6">
              <div
                className={`transition-opacity duration-150 ${contentVisible ? 'opacity-100' : 'opacity-0'}`}
              >
                <ActiveContent />
              </div>

              {/* Bottom nav */}
              <div className="flex justify-between mt-8 pt-4 border-t">
                <button
                  onClick={() => handleTabChange(TABS[Math.max(0, currentIndex - 1)].id)}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 rounded-md border text-sm disabled:opacity-30 hover:bg-muted transition-colors"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => handleTabChange(TABS[Math.min(TABS.length - 1, currentIndex + 1)].id)}
                  disabled={currentIndex === TABS.length - 1}
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-30 hover:bg-primary/90 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
