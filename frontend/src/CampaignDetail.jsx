import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiUrl } from './config';
import Header from './components/Header';
import RegisterCampaign from './RegisterCampaign';
import StatusBadge from './components/StatusBadge';
import './CampaignDetail.css';

/**
 * Campaign Detail Page
 * Fetches and displays full information for a specific campaign.
 */
export default function CampaignDetail({
  theme,
  onToggleTheme,
  stellarNetwork,
  onChangeStellarNetwork,
  walletAddress,
  walletBalance,
  rewardsPoints,
  isWalletLoading,
  isWalletBalanceLoading,
  isRewardsPointsLoading,
  onConnectWallet,
  onDisconnectWallet,
  onRefreshPoints,
}) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [campaign, setCampaign] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Referral state
  const [referralCount, setReferralCount] = useState(0);
  const [bonusEarned, setBonusEarned] = useState(0);
  const [refLinkCopied, setRefLinkCopied] = useState(false);

  // The referrer address embedded in the URL when arriving via an invite link
  const incomingRef = searchParams.get('ref');

  useEffect(() => {
    const controller = new AbortController();

    setIsLoading(true);
    setError('');

    fetch(apiUrl(`/api/v1/campaigns/${id}`), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Campaign not found');
          }

          throw new Error(`API returned ${response.status}`);
        }

        return response.json();
      })
      .then((data) => {
        setCampaign(data);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Unable to load campaign details.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [id, retryCount]);

  // Load referral stats whenever wallet or campaign changes
  useEffect(() => {
    if (!walletAddress || !id) return;

    fetch(apiUrl(`/api/v1/campaigns/${id}/referrals/${walletAddress}`))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setReferralCount(data.referralCount ?? 0);
          setBonusEarned(data.bonusEarned ?? 0);
        }
      })
      .catch(() => {});
  }, [walletAddress, id]);

  // Record incoming referral after a successful registration
  const handleRegistered = useCallback(() => {
    if (!incomingRef || !walletAddress || !id) return;
    if (incomingRef === walletAddress) return;

    fetch(apiUrl(`/api/v1/campaigns/${id}/referrals`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referrerAddress: incomingRef, refereeAddress: walletAddress }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => {});
  }, [incomingRef, walletAddress, id]);

  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return new Intl.DateTimeFormat('en', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(date);
  };

  const buildInviteLink = () => {
    const base = `${window.location.origin}/campaign/${id}`;
    const shortAddress = walletAddress.slice(0, 8) + walletAddress.slice(-4);
    return `${base}?ref=${walletAddress}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(buildInviteLink());
      setRefLinkCopied(true);
      setTimeout(() => setRefLinkCopied(false), 2000);
    } catch (_) {
      // Clipboard API unavailable — silent fail
    }
  };

  const buildShareText = () => {
    const name = campaign?.name ?? 'this campaign';
    return encodeURIComponent(
      `Join me on ${name} and earn rewards on Stellar! ${buildInviteLink()}`,
    );
  };

  return (
    <div className="campaign-detail-page">
      <Header
        theme={theme}
        onToggleTheme={onToggleTheme}
        stellarNetwork={stellarNetwork}
        onChangeStellarNetwork={onChangeStellarNetwork}
        walletAddress={walletAddress}
        walletBalance={walletBalance}
        isWalletBalanceLoading={isWalletBalanceLoading}
        isWalletLoading={isWalletLoading}
        onConnectWallet={onConnectWallet}
        onDisconnectWallet={onDisconnectWallet}
      />

      <main className="detail-main">
        <div className="detail-container">
          <nav className="detail-nav">
            <Link to="/" className="back-link">
              Back to campaigns
            </Link>
            <Link to={`/campaign/${id}/leaderboard`} className="btn btn-secondary detail-leaderboard-btn">
              View leaderboard
            </Link>
          </nav>

          {isLoading ? (
            <div className="detail-status">Loading campaign details...</div>
          ) : error ? (
            <div className="detail-error" role="alert">
              <h2>Error</h2>
              <p>{error}</p>
              <div className="detail-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setRetryCount((count) => count + 1)}
                >
                  Retry request
                </button>
                <Link to="/" className="btn btn-secondary">
                  Return to landing
                </Link>
              </div>
            </div>
          ) : (
            <article className="detail-content">
              <header className="detail-header">
                <p className="detail-eyebrow">Campaign #{campaign.id}</p>
                <div className="detail-title-row">
                  <h1 className="detail-title">{campaign.name}</h1>
                  <StatusBadge status={campaign.status} />
                </div>
              </header>

              <div className="detail-body">
                <section className="detail-section">
                  <h2>Description</h2>
                  <p className="detail-description">
                    {campaign.description || 'No description provided.'}
                  </p>
                </section>

                <div className="detail-grid">
                  <div className="detail-stat">
                    <h3>Reward per Action</h3>
                    <p className="stat-value">{campaign.rewardPerAction ?? 0} pts</p>
                  </div>
                  <div className="detail-stat">
                    <h3>Created On</h3>
                    <p className="stat-value">{formatDate(campaign.createdAt)}</p>
                  </div>
                </div>

                <section className="detail-cta">
                  <h3>Ready to participate?</h3>
                  <p>
                    Rewards are issued automatically through the Stellar Soroban smart contract
                    assigned to this campaign.
                  </p>

                  {walletAddress ? (
                    <RegisterCampaign
                      walletAddress={walletAddress}
                      onRegistered={handleRegistered}
                    />
                  ) : (
                    <div>
                      <button
                        className="btn btn-primary"
                        onClick={onConnectWallet}
                        disabled={isWalletLoading}
                      >
                        {isWalletLoading ? 'Connecting...' : 'Connect wallet to register'}
                      </button>
                      <p className="cta-note">
                        Connect your Freighter wallet to register for this campaign.
                      </p>
                    </div>
                  )}
                </section>

                {walletAddress && (
                  <section className="referral-section" aria-label="Invite friends">
                    <div className="referral-header">
                      <h3 className="referral-title">Invite Friends</h3>
                      {campaign.referralBonusPoints > 0 && (
                        <p className="referral-bonus-note">
                          Earn <strong>+{campaign.referralBonusPoints} bonus pts</strong> per friend who registers
                        </p>
                      )}
                    </div>

                    <div className="referral-stats">
                      <div className="referral-stat">
                        <span className="referral-stat-value">{referralCount}</span>
                        <span className="referral-stat-label">
                          {referralCount === 1 ? 'friend invited' : 'friends invited'}
                        </span>
                      </div>
                      {campaign.referralBonusPoints > 0 && (
                        <div className="referral-stat">
                          <span className="referral-stat-value">{bonusEarned}</span>
                          <span className="referral-stat-label">bonus pts earned</span>
                        </div>
                      )}
                    </div>

                    <div className="referral-link-row">
                      <input
                        className="referral-link-input"
                        type="text"
                        readOnly
                        value={buildInviteLink()}
                        aria-label="Your referral link"
                        onFocus={(e) => e.target.select()}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary referral-copy-btn"
                        onClick={handleCopyLink}
                        aria-live="polite"
                      >
                        {refLinkCopied ? 'Copied!' : 'Copy link'}
                      </button>
                    </div>

                    <div className="referral-share-row" role="group" aria-label="Share on social media">
                      <a
                        href={`https://twitter.com/intent/tweet?text=${buildShareText()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn referral-share-btn referral-share-twitter"
                      >
                        Share on X
                      </a>
                      <a
                        href={`https://discord.com/channels/@me`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn referral-share-btn referral-share-discord"
                        title="Open Discord and share your link"
                        onClick={handleCopyLink}
                      >
                        Share on Discord
                      </a>
                      <a
                        href={`https://t.me/share/url?url=${encodeURIComponent(buildInviteLink())}&text=${encodeURIComponent(`Join ${campaign?.name ?? 'this campaign'} on Trivela and earn Stellar rewards!`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn referral-share-btn referral-share-telegram"
                      >
                        Share on Telegram
                      </a>
                    </div>
                  </section>
                )}
              </div>
            </article>
          )}
        </div>
      </main>

      <footer className="footer detail-footer">
        <div className="footer-inner">
          <p>Copyright 2026 Trivela - Built for Stellar Wave</p>
        </div>
      </footer>
    </div>
  );
}
