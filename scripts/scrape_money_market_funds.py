import yfinance as yf
import pandas as pd


def get_schwab_yields():
    # List of common Schwab Money Market Tickers
    # Includes Prime, Government, Treasury, and Municipal (Tax-Free) funds
    tickers = [
        "SWVXX",
        "SNAXX",  # Prime
        "SNVXX",
        "SGUXX",  # Government
        "SNOXX",
        "SCOXX",  # Treasury Obligations
        "SNSXX",
        "SUTXX",  # U.S. Treasury
        "SWTXX",
        "SWOXX",  # Municipal
        "SWKXX",
        "SCAXX",  # California Municipal
        "SWYXX",
        "SNYXX",  # New York Municipal
        "SWWXX",
        "SCTXX",  # AMT Tax-Free
    ]

    data_list = []

    print(f"Fetching data for {len(tickers)} Schwab funds...")

    for symbol in tickers:
        try:
            fund = yf.Ticker(symbol)
            info = fund.info

            # Money markets report 'yield' as their primary return metric
            # We check a few keys as Yahoo sometimes shifts where the yield is stored
            raw_yield = info.get("yield") or info.get("trailingAnnualDividendYield")

            # Convert decimal (e.g., 0.045) to percentage (4.50%)
            yield_pct = f"{raw_yield * 100:.2f}%" if raw_yield else "N/A"

            data_list.append(
                {
                    "Ticker": symbol,
                    "Fund Name": info.get("shortName", "N/A"),
                    "7-Day Yield": yield_pct,
                    "Category": info.get("category", "N/A"),
                    "Net Assets": (
                        f"${info.get('totalAssets', 0) / 1e9:.2f}B"
                        if info.get("totalAssets")
                        else "N/A"
                    ),
                }
            )
        except Exception as e:
            print(f"Could not fetch {symbol}: {e}")

    # Create and clean the DataFrame
    df = pd.DataFrame(data_list)
    return df


if __name__ == "__main__":
    df_yields = get_schwab_yields()
    df_yields.to_csv("schwab_money_market_yields.csv", index=False)
    # Sort by Ticker and display
    print("\n--- Schwab Money Market Yields (via Yahoo Finance) ---")
    print(df_yields.sort_values("Ticker").to_string(index=False))
