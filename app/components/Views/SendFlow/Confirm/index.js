import React, { PureComponent } from 'react';
import { colors, baseStyles, fontStyles } from '../../../../styles/common';
import {
	InteractionManager,
	StyleSheet,
	SafeAreaView,
	View,
	Alert,
	Text,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator
} from 'react-native';
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
	renderFiatAddition,
	toWei
} from '../../../../util/number';
import { getTicker, decodeTransferData } from '../../../../util/transactions';
import StyledButton from '../../../UI/StyledButton';
import { hexToBN, BNToHex } from 'gaba/dist/util';
import { prepareTransaction } from '../../../../actions/newTransaction';
import { fetchBasicGasEstimates, convertApiValueToGWEI } from '../../../../util/custom-gas';
import Engine from '../../../../core/Engine';
import Logger from '../../../../util/Logger';
import ActionModal from '../../../UI/ActionModal';
import CustomGas from '../CustomGas';
import ErrorMessage from '../ErrorMessage';
import TransactionsNotificationManager from '../../../../core/TransactionsNotificationManager';
import { strings } from '../../../../../locales/i18n';

const AVERAGE_GAS = 20;
const LOW_GAS = 10;
const FAST_GAS = 40;

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
	},
	loader: {
		backgroundColor: colors.white,
		height: 10
	},
	customGasModalTitle: {
		borderBottomColor: colors.grey100,
		borderBottomWidth: 1
	},
	customGasModalTitleText: {
		...fontStyles.bold,
		fontSize: 18,
		alignSelf: 'center',
		margin: 16
	},
	errorMessageWrapper: {
		marginTop: 16,
		marginHorizontal: 24
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
		contractExchangeRates: PropTypes.object,
		prepareTransaction: PropTypes.func
	};

	state = {
		customGasModalVisible: false,
		currentCustomGasSelected: 'average',
		customGasSelected: 'average',
		gasEstimationReady: false,
		customGas: undefined,
		customGasPrice: undefined,
		fromAccountBalance: undefined,
		transactionValue: undefined,
		transactionValueFiat: undefined,
		transactionFee: undefined,
		transactionTotalAmount: undefined,
		transactionTotalAmountFiat: undefined,
		errorMessage: undefined
	};

	componentDidMount = async () => {
		this.parseTransactionData();
		this.prepareTransaction();
	};

	parseTransactionData = () => {
		const {
			accounts,
			contractBalances,
			contractExchangeRates,
			conversionRate,
			currentCurrency,
			transactionState: {
				selectedAsset,
				transactionTo: to,
				transaction: { from, value, gas, gasPrice, data }
			},
			ticker
		} = this.props;
		let fromAccountBalance,
			transactionValue,
			transactionValueFiat,
			transactionTo,
			transactionTotalAmount,
			transactionTotalAmountFiat;
		const weiTransactionFee = gas && gas.mul(gasPrice);
		const valueBN = hexToBN(value);
		const transactionFeeFiat = weiToFiat(weiTransactionFee, conversionRate, currentCurrency);
		const parsedTicker = getTicker(ticker);

		if (selectedAsset.isEth) {
			fromAccountBalance = `${renderFromWei(accounts[from].balance)} ${parsedTicker}`;
			transactionValue = `${renderFromWei(value)} ${parsedTicker}`;
			transactionValueFiat = weiToFiat(valueBN, conversionRate, currentCurrency);
			const transactionTotalAmountBN = weiTransactionFee && weiTransactionFee.add(valueBN);
			transactionTotalAmount = `${renderFromWei(transactionTotalAmountBN)} ${parsedTicker}`;
			transactionTotalAmountFiat = weiToFiat(transactionTotalAmountBN, conversionRate, currentCurrency);
			transactionTo = to;
		} else {
			// TODO check if user has token in case of confirm
			let amount;
			const { address, symbol = 'ERC20', decimals } = selectedAsset;
			fromAccountBalance = `${renderFromTokenMinimalUnit(contractBalances[address], decimals)} ${symbol}`;
			[transactionTo, , amount] = decodeTransferData('transfer', data);
			const transferValue = renderFromTokenMinimalUnit(amount, decimals);
			transactionValue = `${transferValue} ${symbol}`;
			const exchangeRate = contractExchangeRates[address];
			const transactionFeeFiatNumber = weiToFiatNumber(weiTransactionFee, conversionRate);
			transactionValueFiat = balanceToFiat(transferValue, conversionRate, exchangeRate, currentCurrency);
			const transactionValueFiatNumber = balanceToFiatNumber(transferValue, conversionRate, exchangeRate);
			transactionTotalAmount = `${transactionValue} + ${renderFromWei(weiTransactionFee)} ${parsedTicker}`;
			transactionTotalAmountFiat = renderFiatAddition(
				transactionValueFiatNumber,
				transactionFeeFiatNumber,
				currentCurrency
			);
		}
		this.setState({
			fromAccountBalance,
			transactionValue,
			transactionValueFiat,
			transactionFeeFiat,
			transactionTo,
			transactionTotalAmount,
			transactionTotalAmountFiat
		});
	};

	prepareTransaction = async () => {
		const {
			prepareTransaction,
			transactionState: { transaction }
		} = this.props;
		const estimation = await this.estimateGas(transaction);
		prepareTransaction({ ...transaction, ...estimation });
		this.parseTransactionData();
		this.setState({ gasEstimationReady: true });
	};

	estimateGas = async transaction => {
		const { TransactionController } = Engine.context;
		const { value, data, to, from } = transaction;
		let estimation;
		try {
			estimation = await TransactionController.estimateGas({
				value,
				from,
				data,
				to
			});
		} catch (e) {
			estimation = { gas: '0x5208' };
		}
		let basicGasEstimates;
		try {
			basicGasEstimates = await fetchBasicGasEstimates();
		} catch (error) {
			Logger.log('Error while trying to get gas limit estimates', error);
			basicGasEstimates = { average: AVERAGE_GAS, safeLow: LOW_GAS, fast: FAST_GAS };
		}
		return {
			gas: hexToBN(estimation.gas),
			gasPrice: toWei(convertApiValueToGWEI(basicGasEstimates.average), 'gwei')
		};
	};

	handleGasFeeSelection = (gas, gasPrice, customGasSelected) => {
		this.setState({ customGas: gas, customGasPrice: gasPrice, customGasSelected });
	};

	handleSetGasFee = () => {
		const { customGas, customGasPrice, customGasSelected } = this.state;
		if (!customGas || !customGasPrice) {
			this.toggleCustomGasModalVisible();
			return;
		}
		this.setState({ gasEstimationReady: false });
		const { prepareTransaction, transactionState } = this.props;
		let transaction = transactionState.transaction;
		transaction = { ...transaction, gas: customGas, gasPrice: customGasPrice };

		prepareTransaction(transaction);
		setTimeout(() => {
			this.parseTransactionData();
			this.setState({
				customGas: undefined,
				customGasPrice: undefined,
				gasEstimationReady: true,
				currentCustomGasSelected: customGasSelected,
				errorMessage: undefined
			});
		}, 100);
		this.toggleCustomGasModalVisible();
	};

	toggleCustomGasModalVisible = () => {
		const { customGasModalVisible } = this.state;
		this.setState({ customGasModalVisible: !customGasModalVisible });
	};

	renderCustomGasModal = () => {
		const { customGasModalVisible, currentCustomGasSelected } = this.state;
		const { gas, gasPrice } = this.props.transactionState.transaction;
		console.log('trabsaction gas', gas, gasPrice);
		return (
			<ActionModal
				modalVisible={customGasModalVisible}
				confirmText={'Set'}
				cancelText={'Cancel'}
				onCancelPress={this.toggleCustomGasModalVisible}
				onRequestClose={this.toggleCustomGasModalVisible}
				onConfirmPress={this.handleSetGasFee}
				cancelButtonMode={'neutral'}
				confirmButtonMode={'confirm'}
			>
				<View style={baseStyles.flexGrow}>
					<View style={styles.customGasModalTitle}>
						<Text style={styles.customGasModalTitleText}>Transaction Fee</Text>
					</View>
					<CustomGas
						selected={currentCustomGasSelected}
						handleGasFeeSelection={this.handleGasFeeSelection}
						gas={gas}
						gasPrice={gasPrice}
					/>
				</View>
			</ActionModal>
		);
	};

	validateGas = () => {
		const { accounts } = this.props;
		const { gas, gasPrice, value, from } = this.props.transactionState.transaction;
		let errorMessage;
		const totalGas = gas.mul(gasPrice);
		const valueBN = hexToBN(value);
		const balanceBN = hexToBN(accounts[from].balance);
		if (valueBN.add(totalGas).gt(balanceBN)) {
			errorMessage = 'Insufficient funds';
			this.setState({ errorMessage });
		}
		return errorMessage;
	};

	prepareTransactionToSend = () => {
		const {
			transactionState: { transaction }
		} = this.props;
		transaction.gas = BNToHex(transaction.gas);
		transaction.gasPrice = BNToHex(transaction.gasPrice);
		return transaction;
	};

	onNext = async () => {
		const { TransactionController } = Engine.context;
		const {
			transactionState: { assetType }
		} = this.props;
		if (this.validateGas()) return;
		try {
			const transaction = this.prepareTransactionToSend();
			const { result, transactionMeta } = await TransactionController.addTransaction(transaction);

			await TransactionController.approveTransaction(transactionMeta.id);
			await new Promise(resolve => resolve(result));

			InteractionManager.runAfterInteractions(() => {
				TransactionsNotificationManager.watchSubmittedTransaction({
					...transactionMeta,
					assetType
				});
			});
		} catch (error) {
			Alert.alert(strings('transactions.transaction_error'), error && error.message, [{ text: 'OK' }]);
		}
	};

	renderIfGastEstimationReady = children => {
		const { gasEstimationReady } = this.state;
		return !gasEstimationReady ? (
			<View style={styles.loader}>
				<ActivityIndicator size="small" />
			</View>
		) : (
			children
		);
	};

	render = () => {
		const {
			transaction: { from },
			transactionToName,
			transactionFromName
		} = this.props.transactionState;
		const {
			gasEstimationReady,
			fromAccountBalance,
			transactionValue,
			transactionValueFiat,
			transactionFeeFiat,
			transactionTo,
			transactionTotalAmount,
			transactionTotalAmountFiat,
			errorMessage
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
							{this.renderIfGastEstimationReady(
								<Text style={[styles.textSummary, styles.textSummaryAmount]}>{transactionFeeFiat}</Text>
							)}
						</View>
						<View style={styles.separator} />
						<View style={styles.summaryRow}>
							<Text style={[styles.textSummary, styles.textBold]}>Total amount</Text>
							{this.renderIfGastEstimationReady(
								<Text style={[styles.textSummary, styles.textSummaryAmount, styles.textBold]}>
									{transactionTotalAmountFiat}
								</Text>
							)}
						</View>
						<View style={styles.totalCryptoRow}>
							{this.renderIfGastEstimationReady(
								<Text style={[styles.textSummary, styles.textCrypto]}>{transactionTotalAmount}</Text>
							)}
						</View>
					</View>
					{errorMessage && (
						<View style={styles.errorMessageWrapper}>
							<ErrorMessage errorMessage={errorMessage} />
						</View>
					)}
					<View style={styles.actionsWrapper}>
						<TouchableOpacity
							style={styles.actionTouchable}
							disabled={!gasEstimationReady}
							onPress={this.toggleCustomGasModalVisible}
						>
							<Text style={styles.actionText}>Adjust transaction fee</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.actionTouchable}>
							<Text style={styles.actionText}>Hex data</Text>
						</TouchableOpacity>
					</View>
				</ScrollView>
				<View style={styles.buttonNextWrapper}>
					<StyledButton
						type={'confirm'}
						disabled={!gasEstimationReady}
						containerStyle={styles.buttonNext}
						onPress={this.onNext}
					>
						Send
					</StyledButton>
				</View>
				{this.renderCustomGasModal()}
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

const mapDispatchToProps = dispatch => ({
	prepareTransaction: transaction => dispatch(prepareTransaction(transaction))
});

export default connect(
	mapStateToProps,
	mapDispatchToProps
)(Confirm);