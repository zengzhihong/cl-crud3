import { renderNode } from "@/utils/vnode";
import { isNull } from "@/utils";
import { getCurrentInstance, h, inject, nextTick, onMounted, reactive } from "vue";

export default {
	name: "cl-table",

	props: {
		columns: {
			type: Array,
			required: true,
			default: () => []
		}
	},

	inject: ["crud"],

	data() {
		return {
			maxHeight: null,
			sort: {
				prop: "",
				order: ""
			},
			data: []
		};
	},

	created() {
		const { "default-sort": defaultSort } = this.$attrs;

		// Set default sort
		if (defaultSort) {
			const { order, prop } = defaultSort;

			// Set request params
			this.crud.params.order = !order ? "" : order === "descending" ? "desc" : "asc";
			this.crud.params.prop = prop;
		}
	},

	mounted() {
		// Crud refresh
		this.$mitt.on("crud.refresh", ({ list }) => {
			this.data = list;
		});

		// Resize
		this.$mitt.on("crud.resize", () => {
			this.calcMaxHeight();
		});

		this.calcMaxHeight();
	},

	methods: {
		// Change sort
		changeSort(prop, order) {
			if (order === "desc") {
				order = "descending";
			}

			if (order === "asc") {
				order = "ascending";
			}

			this.$refs["table"].sort(this.sort.prop, "");
			this.$refs["table"].sort(prop, order);

			this.sort = {
				prop,
				order
			};
		},

		// Calc table max height
		calcMaxHeight() {
			// cl-crud parent node
			const el = this.crud.$el.parentNode;
			// Is Auto height
			const { height = 0 } = this.$attrs;

			return nextTick(() => {
				if (el) {
					let rows = el.querySelectorAll(".cl-crud .el-row");

					if (!rows[0] || !rows[0].isConnected) {
						return false;
					}

					let h = 20;

					for (let i = 0; i < rows.length; i++) {
						let f = true;

						for (let j = 0; j < rows[i].childNodes.length; j++) {
							if (rows[i].childNodes[j].className == "cl-table") {
								f = false;
							}
						}

						if (f) {
							h += rows[i].clientHeight + 10;
						}
					}

					let h1 = Number(String(height).replace("px", ""));
					let h2 = el.clientHeight - h;
					console.log(111);

					this.maxHeight = h1 > h2 ? h1 : h2;
				}
			});
		}
	},

	setup(props, { slots }) {
		const crud = inject("crud");
		const { ctx } = getCurrentInstance();

		// Render el-table-column
		const renderColumn = () => {
			return props.columns
				.filter(e => !e.hidden)
				.map((item, index) => {
					const deep = item => {
						// el-table-column
						const ElTableColumn = (
							<el-table-column key={`crud-table-column-${index}`}></el-table-column>
						);

						// Op
						if (item.type === "op") {
							return h(
								ElTableColumn,
								{
									label: "操作",
									width: "160px",
									...item
								},
								{
									default: scope => {
										const render = () => {
											return (item.layout || ["edit", "delete"]).map(
												vnode => {
													if (
														["edit", "update", "delete"].includes(vnode)
													) {
														// Get permission
														const perm = crud.getPermission(vnode);

														if (perm) {
															let clickEvent = () => {};
															let buttonText = null;

															switch (vnode) {
																case "edit":
																case "update":
																	clickEvent = crud.rowEdit;
																	buttonText = "编辑";
																	break;
																case "delete":
																	clickEvent = crud.rowDelete;
																	buttonText = "删除";
																	break;
															}

															return (
																<el-button
																	size="mini"
																	type="text"
																	onClick={() => {
																		clickEvent(scope.row);
																	}}>
																	{buttonText}
																</el-button>
															);
														}
													} else {
														// Use custom render
														return renderNode(vnode, { scope, slots });
													}
												}
											);
										};

										return <div class="cl-table__op">{render()}</div>;
									}
								}
							);
						}
						// Index, Expand, Selection
						else if (["selection", "index", "expand"].includes(item.type)) {
							return h(ElTableColumn, item);
						}
						// Default
						else {
							return h(
								ElTableColumn,
								{
									...item
								},
								{
									default: scope => {
										// Scope data
										let newScope = {
											...scope,
											...item
										};

										// Value
										let value = scope.row[item.prop];

										// Column-slot
										let slot = slots[`column-${item.prop}`];

										if (slot) {
											// Use slot
											return slot({
												scope: newScope
											});
										} else {
											// If component
											if (item.component) {
												return renderNode(item.component, {
													prop: item.prop,
													scope: newScope.row
												});
											}
											// Formatter
											else if (item.formatter) {
												return item.formatter(
													newScope.row,
													newScope.column,
													newScope.row[item.prop],
													newScope.$index
												);
											}
											// Dict tag
											else if (item.dict) {
												let data = item.dict.find(d => d.value == value);

												if (data) {
													const ElTag = (
														<el-tag
															disable-transitions
															size="small"
															effect="dark"></el-tag>
													);

													// Use el-tag
													return h(ElTag, data, data.label);
												} else {
													return value;
												}
											}
											// Empty text
											else if (isNull(value)) {
												return scope.emptyText;
											}
											// Value
											else {
												return value;
											}
										}
									},
									header: scope => {
										let slot = slots[`header-${item.prop}`];

										if (slot) {
											return slot({
												scope
											});
										} else {
											return scope.column.label;
										}
									}
								}
							);
						}
					};

					return deep(item);
				});
		};

		// Emit selection change
		const onSelectionChange = selection => {
			ctx.$mitt.emit("table.selection-change", selection);
		};

		return () => {
			// el-table
			const ElTable = <el-table ref="table" border v-loading={crud.loading}></el-table>;

			return h(
				ElTable,
				{
					data: ctx.data,
					maxHeight: ctx.maxHeight,
					onSelectionChange
				},
				{
					default: () => {
						return renderColumn();
					},
					empty: () => {
						return slots.empty ? slots.empty(ctx) : null;
					},
					append: () => {
						return slots.append ? slots.append(ctx) : null;
					}
				}
			);
		};
	}
};