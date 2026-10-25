import { useState, useMemo } from 'react';
import { 
    X, Shield, Car, Hotel, Eye, Smartphone, AlertTriangle, 
    CheckCircle2, Search, PhoneCall, ChevronDown, 
    Sparkles, Compass, ShieldAlert, Key, Flame
} from 'lucide-react';

interface SafetyTipsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export interface SafetyTip {
    id: string;
    category: 'transit' | 'hotel' | 'street' | 'digital' | 'defense';
    title: string;
    priority: 'Critical' | 'Essential' | 'Pro Tip';
    icon: any;
    summary: string;
    details: string[];
    actionableAdvice: string;
}

export const SAFETY_TIPS: SafetyTip[] = [
    // ── Transit & Rideshare ──
    {
        id: 'transit-1',
        category: 'transit',
        title: 'Verify Cab Details Before Stepping In',
        priority: 'Critical',
        icon: Car,
        summary: 'Never enter a cab or rideshare without matching the license plate, driver photo, and vehicle model.',
        details: [
            'Check the license plate number against the app before opening the door.',
            'Never answer "Who are you waiting for?" — instead ask: "Who are you picking up?" and make the driver say your name.',
            'Confirm the child-lock is not active by testing the interior door handle as soon as you sit down.'
        ],
        actionableAdvice: 'If the plate or driver does not match 100%, cancel immediately and do not get in.'
    },
    {
        id: 'transit-2',
        category: 'transit',
        title: 'The Backseat Diagonal Position',
        priority: 'Essential',
        icon: Car,
        summary: 'Always sit diagonally behind the driver in the rear passenger seat, never directly behind or up front.',
        details: [
            'Sitting diagonally puts the maximum physical distance between you and the driver.',
            'It prevents the driver from watching you directly in the rearview mirror without turning their head.',
            'It gives you instant access to both rear exit doors in an emergency.'
        ],
        actionableAdvice: 'Avoid sitting in the front passenger seat in solo rideshares or taxis.'
    },
    {
        id: 'transit-3',
        category: 'transit',
        title: 'Share Live Trip & Strategic Phone Call',
        priority: 'Critical',
        icon: Smartphone,
        summary: 'Share live trip links with your Guard Circle, and make an audible strategic phone call if uneasy.',
        details: [
            'Share the live ride link or your SHEild live location before the vehicle pulls away.',
            'If the route feels unfamiliar or the driver seems uncomfortable, place a call (or simulate one): "Hey, I\'m in cab DL-3C-XXXX, driver is taking the Ring Road, see you at the gate in 10 minutes."',
            'Letting the driver know someone expects you immediately deters misconduct.'
        ],
        actionableAdvice: 'Use SHEild’s Guardian Circle live tracking so your trusted contacts see your exact movements.'
    },
    {
        id: 'transit-4',
        category: 'transit',
        title: 'Public Transit & Late Night Commutes',
        priority: 'Essential',
        icon: Compass,
        summary: 'Stay near conductors or drivers and avoid completely empty train or metro coaches at night.',
        details: [
            'Use designated Women’s Coaches on metros and suburban trains whenever available.',
            'If travelling by bus after dark, sit close to the driver or conductor rather than at the back.',
            'If waiting at a station, stand near illuminated CCTV cameras, emergency call boxes, or station staff.'
        ],
        actionableAdvice: 'If a coach empties out late at night, change compartments at the next stop.'
    },
    {
        id: 'transit-5',
        category: 'transit',
        title: 'Safe Drop-Off Location Strategy',
        priority: 'Essential',
        icon: Car,
        summary: 'Never let a cab drop you at an unlit door; choose a brightly lit store or active guard booth.',
        details: [
            'If you feel watched or unsafe, ask the cab to drop you 50 meters away at a 24/7 store or society security gate.',
            'Wait until the cab has completely driven away before walking toward your exact apartment or entrance.',
            'Have your house or room keys already in your hand before exiting the vehicle.'
        ],
        actionableAdvice: 'Never search through your handbag for keys while standing in a dark street or hallway.'
    },

    // ── Hotel & Accommodations ──
    {
        id: 'hotel-1',
        category: 'hotel',
        title: 'The 2nd to 4th Floor Sweet Spot',
        priority: 'Essential',
        icon: Hotel,
        summary: 'Request a hotel or hostel room located between the 2nd and 4th floors.',
        details: [
            'Ground-floor and 1st-floor rooms have the highest rates of unauthorized break-ins and street access.',
            'Floors above the 4th floor are often too high for standard fire department ladder trucks to reach in emergencies.',
            'Rooms near elevators or well-trafficked hallways have higher natural visibility.'
        ],
        actionableAdvice: 'Ask the front desk politely during check-in: "Do you have a room between the 2nd and 4th floor available?"'
    },
    {
        id: 'hotel-2',
        category: 'hotel',
        title: 'Discreet Check-In & Room Number Secrecy',
        priority: 'Critical',
        icon: Key,
        summary: 'Never let hotel staff say your room number aloud in a crowded lobby or in front of strangers.',
        details: [
            'If the receptionist calls out your room number, ask for a different room and request they write it down silently.',
            'Never mention your room number in public hearing (e.g. elevators, pool, restaurant, or hotel bar).',
            'When ordering food or services, sign with your initial and last name rather than full first name.'
        ],
        actionableAdvice: 'Keep your room keycard in a sleeve so the room number is hidden from bystanders.'
    },
    {
        id: 'hotel-3',
        category: 'hotel',
        title: 'Double-Lock & The Portable Doorstop Rule',
        priority: 'Critical',
        icon: Hotel,
        summary: 'Always engage deadbolts and carry an inexpensive rubber wedge doorstop inside your door.',
        details: [
            'Hotel electronic keycards can be duplicated or master-keyed by hotel staff or prior guests.',
            'Sliding an inexpensive rubber wedge doorstop under the door from the inside prevents the door from opening even if unlocked from outside.',
            'Always engage the manual deadbolt and flip the security latch immediately upon entering.'
        ],
        actionableAdvice: 'Pack a 100-gram rubber doorstop in your luggage — it is one of the most effective solo travel tools.'
    },
    {
        id: 'hotel-4',
        category: 'hotel',
        title: 'Hidden Camera & Mirror Sweep',
        priority: 'Essential',
        icon: Eye,
        summary: 'Perform a 2-minute visual check of mirrors, smoke detectors, clock radios, and AC vents.',
        details: [
            'Use the fingernail test on mirrors: if your fingernail touches its reflection directly with zero gap, it may be a two-way mirror (a real mirror has a 1-2mm glass gap).',
            'Turn off all room lights and scan the room slowly using your smartphone camera with flash on — camera lenses reflect a distinct purple/white glare.',
            'Inspect alarm clocks, smoke detectors, TV frames, and power socket holes facing the bed or bathroom.'
        ],
        actionableAdvice: 'If anything looks suspicious, drape a towel over it or ask the front desk to move rooms.'
    },
    {
        id: 'hotel-5',
        category: 'hotel',
        title: 'The "Room Occupied" Illusion',
        priority: 'Pro Tip',
        icon: Hotel,
        summary: 'Make your room look continuously occupied even when you are out exploring.',
        details: [
            'Keep the "Do Not Disturb" sign hanging on the door handle throughout your entire stay.',
            'Leave a low bedside lamp on and keep the TV playing quietly on a news or dialogue channel.',
            'Housekeeping can be requested explicitly by calling front desk when you are present.'
        ],
        actionableAdvice: 'An apparently occupied room discourages opportunistic burglaries or unauthorized entry.'
    },

    // ── Street Smarts & Awareness ──
    {
        id: 'street-1',
        category: 'street',
        title: 'The One-Ear / Transparency Rule',
        priority: 'Critical',
        icon: Eye,
        summary: 'Never wear noise-cancelling headphones over both ears while walking alone outdoors.',
        details: [
            'Keep at least one ear completely uncovered or activate audio transparency mode.',
            'Auditory cues (approaching footsteps, vehicle engines, bike bells, whispers) are your first line of defense.',
            'Avoid looking down at your smartphone while walking — look up and scan your surroundings every 10 seconds.'
        ],
        actionableAdvice: 'Hold your phone securely at chest level if navigating, with head upright and eyes active.'
    },
    {
        id: 'street-2',
        category: 'street',
        title: 'Walk with Purpose, Command & Direct Eye Contact',
        priority: 'Essential',
        icon: Compass,
        summary: 'Project confidence with upright posture, brisk pace, and brief direct eye contact.',
        details: [
            'Predators consistently select targets that appear distracted, lost, timid, or hesitant.',
            'Walk briskly with shoulders back, chin elevated, and purposeful steps even if you are lost.',
            'Make 1 to 2 seconds of firm, neutral eye contact with people approaching you — it signals "I see you and I can identify you."'
        ],
        actionableAdvice: 'If lost, step inside a lit store or cafe to check maps rather than standing confused on the street.'
    },
    {
        id: 'street-3',
        category: 'street',
        title: 'The "Circle Test" If You Suspect You Are Being Followed',
        priority: 'Critical',
        icon: AlertTriangle,
        summary: 'Make 4 consecutive right turns to verify if someone is deliberately tracking you.',
        details: [
            'Making 4 right turns takes you in a complete box back to where you started. No ordinary pedestrian has reason to do this.',
            'If the person is still behind you after 3-4 turns, you are confirmed being followed.',
            'NEVER walk home, to your hotel, or to a parked car if you are being followed.'
        ],
        actionableAdvice: 'Immediately walk into the nearest populated bank ATM, busy cafe, hospital, or police booth and announce the situation.'
    },
    {
        id: 'street-4',
        category: 'street',
        title: 'Trust Your Instincts Without Apology',
        priority: 'Critical',
        icon: ShieldAlert,
        summary: 'Never ignore that subtle uneasy feeling just to be "polite" or avoid looking silly.',
        details: [
            'Your gut feeling is evolutionary subconscious data processing danger cues before your conscious brain recognizes them.',
            'If an elevator has someone who gives you bad vibes, step out immediately: "Forgot my phone upstairs."',
            'If someone follows too closely on the sidewalk, cross the street with decisive speed.'
        ],
        actionableAdvice: 'Your safety is a million times more important than offending someone else\'s feelings.'
    },

    // ── Digital & Technology ──
    {
        id: 'digital-1',
        category: 'digital',
        title: 'The "Post-Delay" Social Media Rule',
        priority: 'Critical',
        icon: Smartphone,
        summary: 'Never post live locations, stories, or hotel tags until after you have physically departed.',
        details: [
            'Posting "Having coffee here right now @Cafe" advertises your exact solo location in real time.',
            'Share vacation stories, hotel photos, and flight check-ins 4-8 hours after leaving the venue or next morning.',
            'Turn off precise location sharing on public social apps (Instagram, Snapchat, Facebook).'
        ],
        actionableAdvice: 'Keep real-time sharing strictly limited to private 1-on-1 channels like SHEild Guard Circle.'
    },
    {
        id: 'digital-2',
        category: 'digital',
        title: 'Download Offline Maps in Advance',
        priority: 'Essential',
        icon: Smartphone,
        summary: 'Always save offline map areas on your phone before departing your hotel or airport.',
        details: [
            'Cellular dead zones, depleted data packs, and sudden roaming drops leave you stranded without navigation.',
            'Download offline Google Maps of the entire city and surrounding transit routes.',
            'Pin your accommodation, nearest police station, and major hospital as saved starred locations.'
        ],
        actionableAdvice: 'Test navigation in airplane mode before stepping out to verify your offline maps work.'
    },
    {
        id: 'digital-3',
        category: 'digital',
        title: 'The 10,000mAh Power Bank Non-Negotiable',
        priority: 'Critical',
        icon: Smartphone,
        summary: 'Never leave your room without an external battery pack and charging cable.',
        details: [
            'A dead phone removes your GPS navigation, emergency dialing, rideshare access, and flashlight.',
            'Keep a 10,000mAh+ power bank charged to 100% and stored in your daypack with a fast charging cable.',
            'Enable Battery Saver Mode when phone battery dips below 30% to conserve vital SOS functions.'
        ],
        actionableAdvice: 'Treat your phone battery like oxygen when traveling solo — never let it drop below 20%.'
    },
    {
        id: 'digital-4',
        category: 'digital',
        title: 'Configure ICE (In Case of Emergency) Screen',
        priority: 'Essential',
        icon: Shield,
        summary: 'Set emergency contacts and blood group visible on your lock screen without unlocking.',
        details: [
            'Both iOS (Medical ID) and Android (Emergency Information) allow emergency contacts to be called from the lock screen.',
            'Include your blood group, emergency contact names/numbers, and severe allergies.',
            'Emergency responders and hospital staff look for this first if you are incapacitated.'
        ],
        actionableAdvice: 'Verify your lock screen emergency button displays at least 2 primary family members.'
    },

    // ── Self-Defense & Emergency Action ──
    {
        id: 'defense-1',
        category: 'defense',
        title: 'The "FIRE!" Shouting Technique',
        priority: 'Critical',
        icon: Flame,
        summary: 'If grabbed, threatened, or attacked, yell "FIRE!" loudly instead of "Help!".',
        details: [
            'Psychological studies show bystanders often freeze or dismiss cries of "Help!" as private disputes.',
            'Shouting "FIRE!" triggers an instinctive survival panic, causing heads to turn, windows to open, and crowds to converge.',
            'Shout from your diaphragm with maximum lung capacity: "FIRE! CALL 112! CALL POLICE!"'
        ],
        actionableAdvice: 'Make noise aggressively — predators rely on silence and fear of making a scene.'
    },
    {
        id: 'defense-2',
        category: 'defense',
        title: 'Pre-Deployment of Keys & Defense Tools',
        priority: 'Critical',
        icon: Key,
        summary: 'Hold your keys or pepper spray ready in your hand before entering corridors or parking lots.',
        details: [
            'Digging through your purse or backpack in a dark parking lot leaves you 100% vulnerable.',
            'Hold your car or house key between your thumb and index finger, or keep your pepper spray nozzle ready.',
            'Walk directly to your vehicle, unlock only the driver door, get inside, and immediately lock all doors.'
        ],
        actionableAdvice: 'Never sit in your parked car looking at your phone — start the engine and drive away promptly.'
    },
    {
        id: 'defense-3',
        category: 'defense',
        title: 'Primary Vulnerable Target Zones',
        priority: 'Essential',
        icon: AlertTriangle,
        summary: 'If forced to physically defend yourself, strike vulnerable anatomy to create an escape window.',
        details: [
            'Your objective is NEVER to fight or subdue an attacker — it is only to stun them and RUN immediately.',
            'Target 1: Eyes (finger gouge or palm heel).',
            'Target 2: Bridge of the nose (upward palm strike).',
            'Target 3: Throat / windpipe (spear fingers or punch).',
            'Target 4: Groin (knee lift or swift kick).',
            'Target 5: Instep/Shin (stamp downward with heel on their top of foot).'
        ],
        actionableAdvice: 'Deliver one violent, surprise strike to a soft target and run toward populated areas shouting for help.'
    },
    {
        id: 'defense-4',
        category: 'defense',
        title: 'Drink & Food Spiking Prevention',
        priority: 'Critical',
        icon: AlertTriangle,
        summary: 'Never leave your beverage unattended and never accept unsealed drinks from anyone.',
        details: [
            'Drink spiking substances (GHB, Rohypnol, Ketamine) are odorless, colorless, and take effect in 10-15 minutes.',
            'Never leave your drink unattended on a table or bar — if you go to the restroom, finish it or order a new one.',
            'At social venues, watch the bartender uncap the bottle or pour directly in front of you.',
            'If you suddenly feel unusually dizzy, disoriented, or heavily intoxicated after 1 drink, alert a venue manager or call an emergency contact immediately.'
        ],
        actionableAdvice: 'Cover the top of your glass with your hand or a coaster when not drinking.'
    },
    {
        id: 'defense-5',
        category: 'defense',
        title: 'The Decoy Wallet Strategy',
        priority: 'Pro Tip',
        icon: Shield,
        summary: 'Carry an inexpensive fake wallet with a few small bills and expired cards.',
        details: [
            'Keep your primary cash, real credit cards, and passport locked in your hotel safe or hidden in an inner body pouch.',
            'Carry a cheap decoy wallet with ~$10-$20 in local cash and expired loyalty cards in your coat or handbag.',
            'If threatened by an armed mugger, throw the decoy wallet 3 meters to the side and run the opposite way.'
        ],
        actionableAdvice: 'Robbers will chase the flying wallet, giving you 5 to 10 seconds of vital escape time.'
    }
];

export default function SafetyTipsModal({ isOpen, onClose }: SafetyTipsModalProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedTipId, setExpandedTipId] = useState<string | null>('transit-1');

    const categories = [
        { id: 'all', label: 'All Tips', count: SAFETY_TIPS.length },
        { id: 'transit', label: '🚕 Transit & Cabs', count: SAFETY_TIPS.filter(t => t.category === 'transit').length },
        { id: 'hotel', label: '🏨 Hotels & Stays', count: SAFETY_TIPS.filter(t => t.category === 'hotel').length },
        { id: 'street', label: '🚶‍♀️ Street Smarts', count: SAFETY_TIPS.filter(t => t.category === 'street').length },
        { id: 'digital', label: '📱 Digital & Tech', count: SAFETY_TIPS.filter(t => t.category === 'digital').length },
        { id: 'defense', label: '🛡️ Self-Defense', count: SAFETY_TIPS.filter(t => t.category === 'defense').length },
    ];

    const filteredTips = useMemo(() => {
        return SAFETY_TIPS.filter(tip => {
            const matchesCategory = selectedCategory === 'all' || tip.category === selectedCategory;
            const query = searchQuery.toLowerCase().trim();
            const matchesSearch = !query || 
                tip.title.toLowerCase().includes(query) || 
                tip.summary.toLowerCase().includes(query) ||
                tip.details.some(d => d.toLowerCase().includes(query)) ||
                tip.actionableAdvice.toLowerCase().includes(query);
            return matchesCategory && matchesSearch;
        });
    }, [selectedCategory, searchQuery]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center items-center bg-black/80 backdrop-blur-md transition-all">
            <div className="w-full max-w-xl bg-surface border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] h-[92vh] overflow-hidden animate-slide-up">
                
                {/* Header */}
                <header className="p-4 sm:p-5 border-b border-white/10 bg-surface-2 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                            <Shield size={22} />
                        </div>
                        <div>
                            <h2 
                                className="font-bold text-white text-base sm:text-lg flex items-center gap-2"
                                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"' }}
                            >
                                Solo Travel & Safety Guide
                                <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                    {filteredTips.length} Tips
                                </span>
                            </h2>
                            <p className="text-xs text-text-3">Essential guidelines every woman should remember</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-text-2 hover:text-white flex items-center justify-center transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </header>

                {/* Search & Filter Bar */}
                <div className="p-3 sm:p-4 border-b border-white/5 bg-bg/60 space-y-3 shrink-0">
                    <div className="relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tips (e.g. cab, hotel, doorstop, stalker, maps)..."
                            className="w-full h-10 bg-surface-2 border border-white/10 rounded-xl pl-10 pr-4 text-xs text-white placeholder:text-text-3 focus:outline-none focus:border-primary/50 transition-colors"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-white text-xs"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Category Pills */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {categories.map(cat => {
                            const isSelected = selectedCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0 ${
                                        isSelected 
                                            ? 'bg-primary text-white border-primary shadow-sm' 
                                            : 'bg-surface-2 text-text-3 border-white/5 hover:text-white hover:border-white/15'
                                    }`}
                                >
                                    {cat.label} ({cat.count})
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Tips List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain">
                    {filteredTips.length === 0 ? (
                        <div className="text-center py-12 px-4 space-y-3 text-text-3">
                            <Sparkles className="mx-auto opacity-40 text-primary" size={32} />
                            <p className="text-sm font-semibold text-white">No tips matching "{searchQuery}"</p>
                            <p className="text-xs">Try searching for keywords like "uber", "hotel", "door", "night", or "keys".</p>
                            <button 
                                onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                                className="text-xs font-bold text-primary hover:underline pt-2 block mx-auto"
                            >
                                Reset Filters
                            </button>
                        </div>
                    ) : (
                        filteredTips.map((tip) => {
                            const isExpanded = expandedTipId === tip.id;
                            const TipIcon = tip.icon;

                            const priorityColor = 
                                tip.priority === 'Critical' 
                                    ? 'bg-red-500/15 text-red-400 border-red-500/30' 
                                    : tip.priority === 'Essential'
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                    : 'bg-blue-500/15 text-blue-400 border-blue-500/30';

                            return (
                                <div 
                                    key={tip.id}
                                    className={`bg-surface-2 border rounded-2xl transition-all overflow-hidden ${
                                        isExpanded 
                                            ? 'border-primary/40 shadow-card bg-surface-2' 
                                            : 'border-white/5 hover:border-white/15 cursor-pointer'
                                    }`}
                                    onClick={() => setExpandedTipId(isExpanded ? null : tip.id)}
                                >
                                    <div className="p-3.5 sm:p-4 flex items-start gap-3 justify-between">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-primary mt-0.5">
                                                <TipIcon size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${priorityColor}`}>
                                                        {tip.priority}
                                                    </span>
                                                    <span className="text-[10px] text-text-3 capitalize">
                                                        {tip.category}
                                                    </span>
                                                </div>
                                                <h3 className="font-bold text-white text-sm leading-snug">
                                                    {tip.title}
                                                </h3>
                                                <p className="text-xs text-text-3 mt-1 leading-relaxed">
                                                    {tip.summary}
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            className={`p-1.5 text-text-3 hover:text-white rounded-lg transition-transform ${isExpanded ? 'rotate-180 text-primary' : ''}`}
                                            aria-label="Toggle details"
                                        >
                                            <ChevronDown size={18} />
                                        </button>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3 bg-black/30">
                                            <div className="space-y-2 mt-2">
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-text-3">
                                                    Key Steps to Remember:
                                                </p>
                                                <ul className="space-y-2">
                                                    {tip.details.map((point, pIdx) => (
                                                        <li key={pIdx} className="text-xs text-text-2 flex items-start gap-2 leading-relaxed">
                                                            <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                                                            <span>{point}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Actionable Rule Callout */}
                                            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-start gap-2.5">
                                                <AlertTriangle size={15} className="text-primary shrink-0 mt-0.5" />
                                                <p className="text-xs text-white/90 font-medium leading-relaxed">
                                                    <strong className="text-primary font-bold">Rule of Thumb: </strong>
                                                    {tip.actionableAdvice}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Emergency Speed Dial Footer */}
                <footer className="p-3.5 sm:p-4 border-t border-white/10 bg-surface-2 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                        <a 
                            href="tel:112"
                            className="px-3 py-2 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-1.5 hover:bg-red-600 hover:text-white transition-all active:scale-95"
                        >
                            <PhoneCall size={13} />
                            Call 112 (Police)
                        </a>
                        <a 
                            href="tel:1091"
                            className="px-3 py-2 rounded-xl bg-pink-600/20 text-pink-400 border border-pink-500/30 text-xs font-bold flex items-center gap-1.5 hover:bg-pink-600 hover:text-white transition-all active:scale-95"
                        >
                            <PhoneCall size={13} />
                            1091 (Women Helpline)
                        </a>
                    </div>
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
                    >
                        Close
                    </button>
                </footer>

            </div>
        </div>
    );
}
