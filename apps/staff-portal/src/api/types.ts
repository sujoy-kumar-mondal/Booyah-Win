/**
 * TypeScript types for Booyah Win Staff Portal
 * Verified directly against real API integration tests & controller outputs.
 */

export type StaffRole = 'employee' | 'admin';

export interface StaffDto {
  id: string;
  role: StaffRole;
  name: string;
  email: string;
  mobile: string;
  createdAt?: string;
}

export interface StaffLoginOtpRequestResponse {
  message: string;
  registered?: boolean;
}

export interface StaffLoginOtpVerifyResponse {
  token: string;
  staff: StaffDto;
}

export interface StaffMeResponse {
  profile: StaffDto;
}

export interface DashboardMetricsDto {
  pendingDepositsCount: number;
  oldestPendingDepositAgeMinutes: number | null;
  isOldestDepositOver30Min: boolean;
  employeeApprovedDepositsCount: number;
  oldestEmployeeApprovedDepositAgeMinutes: number | null;
  isOldestEmployeeApprovedDepositOver30Min: boolean;
  pendingWithdrawalsCount: number;
  oldestPendingWithdrawalAgeMinutes: number | null;
  employeeApprovedWithdrawalsCount: number;
  oldestEmployeeApprovedWithdrawalAgeMinutes: number | null;
  isOldestEmployeeApprovedWithdrawalOver24Hours: boolean;
  liveMatchesCount: number;
  upcomingMatchesCount: number;
  roomOpenMatchesCount: number;
  completedMatchesCount: number;
  resultsWaitingApprovalCount: number;
}

export interface StaffDepositDto {
  id: string;
  userId: string;
  userName?: string;
  userEmail: string;
  amount: string;
  utr: string;
  screenshotUrl: string;
  status: 'pending' | 'employee_approved' | 'approved' | 'rejected';
  rejectReason?: string | null;
  needsAdmin: boolean;
  pendingMinutes?: number | null;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  employeeReviewedAt?: string | null;
  employeeReviewedBy?: string | null;
}

export interface DepositListResponse {
  items: StaffDepositDto[];
  nextCursor?: string | null;
}

export interface StaffWithdrawalDto {
  id: string;
  userId: string;
  userName?: string;
  userEmail: string;
  amount: string;
  upiId: string;
  status: 'pending' | 'employee_approved' | 'paid' | 'rejected';
  rejectReason?: string | null;
  payoutRef?: string | null;
  createdAt: string;
  processedAt?: string | null;
  processedBy?: string | null;
  employeeReviewedAt?: string | null;
  employeeReviewedBy?: string | null;
}

export interface WithdrawalListResponse {
  items: StaffWithdrawalDto[];
  nextCursor?: string | null;
}

export interface GenericMessageResponse {
  message: string;
}

// ─── Entry Tiers ─────────────────────────────────────────────────────────────

export interface TierPositionDto {
  position: number;
  prize: string;
}

export interface EntryTierDto {
  id: string;
  gameMode: 'battle_royale' | 'clash_squad';
  teamMode: 'solo' | 'duo' | 'squad';
  entryFee: string;
  killPrice: string;
  minKillsForReward: number;
  maxPlayers: number;
  minPlayers: number;
  positions: TierPositionDto[];
  createdAt: string;
}

export interface EntryTiersResponse {
  tiers: EntryTierDto[];
}

// ─── Matches ─────────────────────────────────────────────────────────────────

export interface MatchStaffDto {
  id: string;
  tierId: string;
  gameMode: 'battle_royale' | 'clash_squad';
  teamMode: 'solo' | 'duo' | 'squad';
  entryFee: string;
  killPrice: string;
  minKillsForReward: number;
  positionPrizes: Record<string, string>;
  maxPlayers: number;
  minPlayers: number;
  startTime: string;
  roomId?: string | null;
  roomPassword?: string | null;
  status: 'upcoming' | 'room_open' | 'live' | 'completed' | 'cancelled';
  cancelReason?: string | null;
  createdBy: string;
  createdAt: string;
  joinedCount: number;
  seatsTaken?: number;
}

export interface MatchListResponse {
  matches: MatchStaffDto[];
  nextCursor?: string | null;
}

export interface CreateMatchRequest {
  tierId: string;
  startTime: string;
}

export interface CreateMatchResponse {
  match: MatchStaffDto;
}

export interface JoinedPlayerDto {
  userId: string;
  name: string;
  ffId: string;
  ffName: string;
  teamId: string | null;
  paidAddMoney: string;
  paidCashback: string;
  paidWinning: string;
  refundedAt: string | null;
  joinedAt: string;
}

export interface MatchTeamStaffDto {
  id: string;
  name: string | null;
  size: number;
  status: 'forming' | 'confirmed' | 'disbanded';
  leaderId: string;
  memberUserIds: string[];
}

export interface MatchDetailStaffDto extends MatchStaffDto {
  players: JoinedPlayerDto[];
  teams: MatchTeamStaffDto[];
}

export interface MatchDetailResponse {
  match: MatchDetailStaffDto;
}

// ─── Results ─────────────────────────────────────────────────────────────────

export interface ResultEntryDto {
  userId: string;
  kills: number;
  position: number | null;
}

export interface MatchResultStaffDto {
  id: string;
  matchId: string;
  entries: ResultEntryDto[];
  screenshotUrl: string;
  signedScreenshotUrl?: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  rejectReason?: string | null;
  submittedBy: string;
  approvedBy?: string | null;
  createdAt: string;
  approvedAt?: string | null;
}

export interface SubmitResultResponse {
  id: string;
  matchId: string;
  status: string;
  screenshotUrl: string;
  approved: boolean;
}

// ─── Admin Results Queue & Preview ──────────────────────────────────────────

export interface AdminQueueItemDto {
  id: string;
  matchId: string;
  status: string;
  submittedBy: string;
  createdAt: string;
  screenshotUrl: string;
  gameMode: string;
  teamMode: string;
  matchStatus: string;
}

export interface AdminQueueResponse {
  results: AdminQueueItemDto[];
  count: number;
}

export interface PayoutPreviewEntryDto {
  userId: string;
  kills: number;
  position: number | null;
  killReward: string;
  positionPrize: string;
  payout: string;
  payoutPaise: number;
  isDeleted: boolean;
}

export interface ResultPayoutPreviewDto {
  entries: PayoutPreviewEntryDto[];
  totalCollected: string;
  totalCollectedPaise: number;
  totalPayout: string;
  totalPayoutPaise: number;
  difference: string;
  differencePaise: number;
  warning: string | null;
}

export interface ApproveResultResponse {
  matchId: string;
  status: 'approved';
  message: string;
}

export interface RejectResultResponse {
  matchId: string;
  status: 'rejected';
  reason: string;
}

export interface ReverseResultResponse {
  matchId: string;
  status: 'reversed';
  message: string;
}

export interface AffectedUserDto {
  userId: string;
  winningPaise: number;
  requiredPaise: number;
}

