import React, { PureComponent } from 'react';
import { colors, baseStyles, fontStyles } from '../../../../styles/common';
import { StyleSheet, SafeAreaView, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { connect } from 'react-redux';
import { getSendFlowTitle } from '../../../UI/Navbar';
import { AddressFrom, AddressTo } from '../AddressInputs';
import PropTypes from 'prop-types';
import {
	renderFromWei,
	renderFromTokenMinimalUnit,
	weiToFiat,
	balanceToFiat,
	weiToFiatNumber,
	balanceToFiatNumber,
	renderFiatAddition
} from '../../../../util/number';
import { getTicker, decodeTransferData } from '../../../../util/transactions';
import StyledButton from '../../../UI/StyledButton';
import { hexToBN, BNToHex } from 'gaba/dist/util';

const styles = StyleSheet.create({
	wrapper: {
		flex: 1,
		backgroundColor: colors.white
	},
	inputWrapper: {
		flex: 0,
		borderBottomWidth: 1,
		borderBottomColor: colors.grey050
	},
	amountWrapper: {
		flexDirection: 'column',
		margin: 24
	},
	textAmountLabel: {
		...fontStyles.normal,
		fontSize: 14,
		textAlign: 'center',
		color: colors.grey500,
		textTransform: 'uppercase',
		marginVertical: 3
	},
	textAmount: {
		...fontStyles.light,
		fontSize: 44,
		textAlign: 'center'
	},
	summaryWrapper: {
		flexDirection: 'column',
		borderWidth: 1,
		borderColor: colors.grey050,
		borderRadius: 8,
		padding: 16,
		marginHorizontal: 24
	},
	summaryRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginVertical: 6
	},
	totalCryptoRow: {
		alignItems: 'flex-end',
		marginTop: 8
	},
	textSummary: {
		...fontStyles.normal,
		color: colors.black,
		fontSize: 12
	},
	textSummaryAmount: {
		textTransform: 'uppercase'
	},
	textCrypto: {
		...fontStyles.normal,
		textAlign: 'right',
		fontSize: 12,
		textTransform: 'uppercase',
		color: colors.grey500
	},
	textBold: {
		...fontStyles.bold,
		alignSelf: 'flex-end'
	},
	separator: {
		borderBottomWidth: 1,
		borderBottomColor: colors.grey050,
		marginVertical: 6
	},
	buttonNext: {
		flex: 1,
		marginHorizontal: 24,
		alignSelf: 'flex-end'
	},
	buttonNextWrapper: {
		flex: 0.1,
		flexDirection: 'row',
		alignItems: 'flex-end'
	},
	actionTouchable: {
		padding: 16
	},
	actionText: {
		...fontStyles.normal,
		color: colors.blue,
		fontSize: 16,
		alignSelf: 'center'
	},
	actionsWrapper: {
		margin: 24
	}
});

/**
 * View that wraps the wraps the "Send" screen
 */
class Confirm extends PureComponent {
	static navigationOptions = ({ navigation }) => getSendFlowTitle('send.confirm', navigation);

	static propTypes = {
		/**
		 * Map of accounts to information objects including balances
		 */
		accounts: PropTypes.object,
		/**
		 * Object containing token balances in the format address => balance
		 */
		contractBalances: PropTypes.object,
		/**
		 * Current provider ticker
		 */
		ticker: PropTypes.string,
		/**
		 * Current transaction state
		 */
		transactionState: PropTypes.object,
		/**
		 * ETH to current currency conversion rate
		 */
		conversionRate: PropTypes.number,
		/**
		 * Currency code of the currently-active currency
		 */
		currentCurrency: PropTypes.string,
		/**
		 * Object containing token exchange rates in the format address => exchangeRate
		 */
		contractExchangeRates: PropTypes.object
	};

	state = {
		fromAccountBalance: undefined,
		transactionValue: undefined,
		transactionValueFiat: undefined,
		transactionFee: undefined,
		transactionTotalAmount: undefined,
		transactionTotalAmountFiat: undefined
	};

	componentDidMount = () => {
		const {
			accounts,
			contractBalances,
			contractExchangeRates,
			conversionRate,
			currentCurrency,
			transactionState: {
				selectedAsset,
				transaction: { from, value, gas, gasPrice, data }
			},
			ticker
		} = this.props;
		let [fromAccountBalance, parsedTransactionValue, transactionValueFiat] = [undefined, undefined, undefined];
		let [transactionFeeFiat, transactionTotalAmount, transactionTotalAmountFiat] = [
			undefined,
			undefined,
			undefined
		];

		const weiTransactionFee = gas.mul(gasPrice);
		transactionFeeFiat = weiToFiat(weiTransactionFee, conversionRate, currentCurrency);

		if (selectedAsset.isEth) {
			fromAccountBalance = `${renderFromWei(accounts[from].balance)} ${getTicker(ticker)}`;

			parsedTransactionValue = `${renderFromWei(value)} ${getTicker(ticker)}`;
			transactionValueFiat = weiToFiat(hexToBN(value), conversionRate, currentCurrency);

			transactionTotalAmount = `${renderFromWei(weiTransactionFee.add(hexToBN(value)))} ${getTicker(ticker)}`;
			transactionTotalAmountFiat = weiToFiat(
				weiTransactionFee.add(hexToBN(value)),
				conversionRate,
				currentCurrency
			);
		} else {
			fromAccountBalance = `${renderFromTokenMinimalUnit(
				contractBalances[selectedAsset.address],
				selectedAsset.decimals
			)} ${selectedAsset.symbol}`;

			const amount = decodeTransferData('transfer', data)[2];
			const transferValue = renderFromTokenMinimalUnit(BNToHex(amount), selectedAsset.decimals);
			parsedTransactionValue = `${transferValue} ${selectedAsset.symbol}`;
			const exchangeRate = contractExchangeRates[selectedAsset.address];
			transactionValueFiat = balanceToFiat(transferValue, conversionRate, exchangeRate, currentCurrency);

			transactionTotalAmount = `${parsedTransactionValue} + ${renderFromWei(weiTransactionFee)} ${getTicker(
				ticker
			)}`;
			const transactionFeeFiatNumber = weiToFiatNumber(weiTransactionFee, conversionRate);
			const transactionValueFiatNumber = balanceToFiatNumber(transferValue, conversionRate, exchangeRate);
			transactionTotalAmountFiat = renderFiatAddition(
				transactionValueFiatNumber,
				transactionFeeFiatNumber,
				currentCurrency
			);
		}

		this.setState({
			fromAccountBalance,
			transactionValue: parsedTransactionValue,
			transactionValueFiat,
			transactionFeeFiat,
			transactionTotalAmount,
			transactionTotalAmountFiat
		});
	};

	render = () => {
		const {
			transaction: { from },
			transactionTo,
			transactionToName,
			transactionFromName
		} = this.props.transactionState;
		const {
			fromAccountBalance,
			transactionValue,
			transactionValueFiat,
			transactionFeeFiat,
			transactionTotalAmount,
			transactionTotalAmountFiat
		} = this.state;
		return (
			<SafeAreaView style={styles.wrapper}>
				<View style={styles.inputWrapper}>
					<AddressFrom
						onPressIcon={this.toggleFromAccountModal}
						fromAccountAddress={from}
						fromAccountName={transactionFromName}
						fromAccountBalance={fromAccountBalance}
					/>
					<AddressTo
						addressToReady
						toSelectedAddress={transactionTo}
						toAddressName={transactionToName}
						onToSelectedAddressChange={this.onToSelectedAddressChange}
					/>
				</View>
				<ScrollView style={baseStyles.flexGrow}>
					<View style={styles.amountWrapper}>
						<Text style={styles.textAmountLabel}>Amount</Text>
						<Text style={styles.textAmount}>{transactionValue}</Text>
						<Text style={styles.textAmountLabel}>{transactionValueFiat}</Text>
					</View>

					<View style={styles.summaryWrapper}>
						<View style={styles.summaryRow}>
							<Text style={styles.textSummary}>Amount</Text>
							<Text style={[styles.textSummary, styles.textSummaryAmount]}>{transactionValueFiat}</Text>
						</View>
						<View style={styles.summaryRow}>
							<Text style={styles.textSummary}>Transaction fee</Text>
							<Text style={[styles.textSummary, styles.textSummaryAmount]}>{transactionFeeFiat}</Text>
						</View>
						<View style={styles.separator} />
						<View style={styles.summaryRow}>
							<Text style={[styles.textSummary, styles.textBold]}>Total amount</Text>
							<Text style={[styles.textSummary, styles.textSummaryAmount, styles.textBold]}>
								{transactionTotalAmountFiat}
							</Text>
						</View>
						<View style={styles.totalCryptoRow}>
							<Text style={[styles.textSummary, styles.textCrypto]}>{transactionTotalAmount}</Text>
						</View>
					</View>
					<View style={styles.actionsWrapper}>
						<TouchableOpacity style={styles.actionTouchable}>
							<Text style={styles.actionText}>Adjust transaction fee</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.actionTouchable}>
							<Text style={styles.actionText}>Hex data</Text>
						</TouchableOpacity>
					</View>
				</ScrollView>

				<View style={styles.buttonNextWrapper}>
					<StyledButton type={'confirm'} containerStyle={styles.buttonNext} onPress={this.onNext}>
						Send
					</StyledButton>
				</View>
			</SafeAreaView>
		);
	};
}

const mapStateToProps = state => ({
	accounts: state.engine.backgroundState.AccountTrackerController.accounts,
	contractBalances: state.engine.backgroundState.TokenBalancesController.contractBalances,
	contractExchangeRates: state.engine.backgroundState.TokenRatesController.contractExchangeRates,
	currentCurrency: state.engine.backgroundState.CurrencyRateController.currentCurrency,
	conversionRate: state.engine.backgroundState.CurrencyRateController.conversionRate,
	ticker: state.engine.backgroundState.NetworkController.provider.ticker,
	transactionState: state.newTransaction
});

export default connect(mapStateToProps)(Confirm);